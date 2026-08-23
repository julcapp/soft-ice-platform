'use strict';

const CAMPAIGN_STATUSES = new Set([
  'DRAFT',
  'VALIDATION_FAILED',
  'READY',
  'SCHEDULED',
  'ACTIVE',
  'PAUSED',
  'PAUSED_BY_SAFETY',
  'PAUSED_BY_BUDGET',
  'ENDED',
  'ARCHIVED',
  'CANCELLED',
]);

const BENEFIT_TYPES = new Set([
  'PERCENT_DISCOUNT',
  'FIXED_DISCOUNT',
  'GIFT',
  'BONUS_REWARD',
  'FREE_ADDON',
  'PERSONAL_OFFER',
]);

const CHANNELS = new Set(['TERMINAL', 'WEB', 'MINI_APP', 'TELEGRAM', 'MAX', 'VK']);
const APPROVAL_POLICIES = new Set(['NONE', 'SINGLE_APPROVAL', 'DUAL_APPROVAL', 'OWNER_APPROVAL']);
const STACKING_MODES = new Set(['BEST_PRICE', 'EXCLUSIVE', 'STACKABLE']);
const BUDGET_ACTIONS = new Set(['STOP', 'NOTIFY_ONLY']);

const REQUIRED_HAPPY_HOUR_RULES = new Map([
  ['BONUS_PAYMENT', 'FORBIDDEN'],
  ['THIRD_PARTY_TRANSFER', 'FORBIDDEN'],
  ['MONEY_DISCOUNT_STACKING', 'FORBIDDEN'],
  ['GIFT_COMPATIBILITY', 'PAID_ITEMS_ONLY'],
]);

function issue(code, message, path, severity = 'ERROR', metadata = undefined) {
  return { code, message, path, severity, ...(metadata ? { metadata } : {}) };
}

function normalizeRuleValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) return value.value;
  return value;
}

function toMinutes(time) {
  if (typeof time !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return null;
  const [h, m, s = '0'] = time.split(':').map(Number);
  if (h > 23 || m > 59 || s > 59) return null;
  return h * 60 + m + s / 60;
}

class PromotionValidationService {
  validateCampaign(campaign) {
    const errors = [];
    const warnings = [];

    if (!campaign || typeof campaign !== 'object') {
      return {
        valid: false,
        nextStatus: 'VALIDATION_FAILED',
        errors: [issue('PROMOTION_REQUIRED', 'Campaign payload is required.', 'campaign')],
        warnings,
      };
    }

    const status = campaign.status || 'DRAFT';
    if (!CAMPAIGN_STATUSES.has(status)) {
      errors.push(issue('INVALID_STATUS', `Unsupported campaign status: ${status}.`, 'status'));
    }

    if (!campaign.code || !String(campaign.code).trim()) {
      errors.push(issue('CODE_REQUIRED', 'Campaign code is required.', 'code'));
    }

    if (!campaign.name || !String(campaign.name).trim()) {
      errors.push(issue('NAME_REQUIRED', 'Campaign name is required.', 'name'));
    }

    const version = campaign.version || campaign.currentVersion;
    if (!version) {
      errors.push(issue('VERSION_REQUIRED', 'A campaign version is required before validation.', 'version'));
      return this._result(errors, warnings);
    }

    this._validateVersion(version, errors, warnings);
    this._validateSchedule(version.schedules || [], errors, warnings);
    this._validateTargets(version.targets || [], errors, warnings);
    this._validateAudiences(version.audiences || [], errors, warnings);
    this._validateChannels(version.channels || [], errors, warnings);
    this._validateRules(campaign.code, version, version.rules || [], errors, warnings);

    return this._result(errors, warnings);
  }

  _validateVersion(version, errors, warnings) {
    if (!Number.isInteger(version.version) || version.version < 1) {
      errors.push(issue('INVALID_VERSION', 'Version number must be a positive integer.', 'version.version'));
    }

    if (!BENEFIT_TYPES.has(version.benefitType)) {
      errors.push(issue('INVALID_BENEFIT_TYPE', `Unsupported benefit type: ${version.benefitType}.`, 'version.benefitType'));
    }

    if (version.benefitType === 'PERCENT_DISCOUNT') {
      const value = Number(version.benefitValue);
      if (!Number.isFinite(value) || value <= 0 || value >= 100) {
        errors.push(issue('INVALID_PERCENT_DISCOUNT', 'Percentage discount must be greater than 0 and less than 100.', 'version.benefitValue'));
      }
    }

    if (!STACKING_MODES.has(version.stackingMode || 'BEST_PRICE')) {
      errors.push(issue('INVALID_STACKING_MODE', 'Unsupported stacking mode.', 'version.stackingMode'));
    }

    if (!APPROVAL_POLICIES.has(version.approvalPolicy || 'SINGLE_APPROVAL')) {
      errors.push(issue('INVALID_APPROVAL_POLICY', 'Unsupported approval policy.', 'version.approvalPolicy'));
    }

    if (!BUDGET_ACTIONS.has(version.budgetAction || 'STOP')) {
      errors.push(issue('INVALID_BUDGET_ACTION', 'Unsupported budget action.', 'version.budgetAction'));
    }

    if (!Number.isInteger(version.priceLockSeconds) || version.priceLockSeconds <= 0) {
      errors.push(issue('INVALID_PRICE_LOCK', 'Price lock must be a positive number of seconds.', 'version.priceLockSeconds'));
    }

    if (version.startsAt && version.endsAt && new Date(version.startsAt) >= new Date(version.endsAt)) {
      errors.push(issue('INVALID_CAMPAIGN_RANGE', 'Campaign end must be later than campaign start.', 'version.endsAt'));
    }

    if (version.minimumFinalPrice !== null && version.minimumFinalPrice !== undefined && Number(version.minimumFinalPrice) < 0) {
      errors.push(issue('INVALID_MINIMUM_PRICE', 'Minimum final price cannot be negative.', 'version.minimumFinalPrice'));
    }

    if (version.budgetAmount !== null && version.budgetAmount !== undefined && Number(version.budgetAmount) < 0) {
      errors.push(issue('INVALID_BUDGET', 'Campaign budget cannot be negative.', 'version.budgetAmount'));
    }

    if (!version.timezone) {
      errors.push(issue('TIMEZONE_REQUIRED', 'Campaign timezone is required.', 'version.timezone'));
    }
  }

  _validateSchedule(schedules, errors, warnings) {
    if (!Array.isArray(schedules) || schedules.filter((item) => item.isEnabled !== false).length === 0) {
      errors.push(issue('SCHEDULE_REQUIRED', 'At least one enabled schedule window is required.', 'version.schedules'));
      return;
    }

    const byDay = new Map();
    schedules.forEach((window, index) => {
      if (window.isEnabled === false) return;
      if (!Number.isInteger(window.dayOfWeek) || window.dayOfWeek < 1 || window.dayOfWeek > 7) {
        errors.push(issue('INVALID_DAY_OF_WEEK', 'dayOfWeek must be between 1 and 7.', `version.schedules[${index}].dayOfWeek`));
        return;
      }
      const start = toMinutes(window.startTime);
      const end = toMinutes(window.endTime);
      if (start === null || end === null) {
        errors.push(issue('INVALID_TIME', 'Schedule time must use HH:MM or HH:MM:SS.', `version.schedules[${index}]`));
        return;
      }
      if (start >= end) {
        errors.push(issue('INVALID_SCHEDULE_WINDOW', 'Schedule end must be later than start.', `version.schedules[${index}]`));
        return;
      }
      const dayWindows = byDay.get(window.dayOfWeek) || [];
      dayWindows.push({ start, end, index });
      byDay.set(window.dayOfWeek, dayWindows);
    });

    for (const [day, windows] of byDay.entries()) {
      windows.sort((a, b) => a.start - b.start);
      for (let i = 1; i < windows.length; i += 1) {
        if (windows[i].start < windows[i - 1].end) {
          errors.push(issue('OVERLAPPING_SCHEDULE_WINDOWS', `Schedule windows overlap on day ${day}.`, `version.schedules[${windows[i].index}]`));
        }
      }
    }
  }

  _validateTargets(targets, errors) {
    if (!Array.isArray(targets) || targets.length === 0) {
      errors.push(issue('TARGET_REQUIRED', 'At least one promotion target is required.', 'version.targets'));
      return;
    }

    targets.forEach((target, index) => {
      if (!target.targetType) {
        errors.push(issue('TARGET_TYPE_REQUIRED', 'Target type is required.', `version.targets[${index}].targetType`));
      }
      if (target.targetType !== 'ALL_MACHINES' && !target.targetId) {
        errors.push(issue('TARGET_ID_REQUIRED', 'targetId is required for this target type.', `version.targets[${index}].targetId`));
      }
    });
  }

  _validateAudiences(audiences, errors) {
    if (!Array.isArray(audiences) || audiences.length === 0) {
      errors.push(issue('AUDIENCE_REQUIRED', 'At least one audience rule is required.', 'version.audiences'));
    }
  }

  _validateChannels(channels, errors, warnings) {
    const enabled = Array.isArray(channels) ? channels.filter((item) => item.enabled !== false) : [];
    if (enabled.length === 0) {
      errors.push(issue('CHANNEL_REQUIRED', 'At least one enabled customer channel is required.', 'version.channels'));
      return;
    }

    enabled.forEach((channel, index) => {
      if (!CHANNELS.has(channel.channel)) {
        errors.push(issue('INVALID_CHANNEL', `Unsupported channel: ${channel.channel}.`, `version.channels[${index}].channel`));
      }
      if (channel.countdownEnabled !== true) {
        warnings.push(issue('COUNTDOWN_DISABLED', `Countdown is disabled for ${channel.channel}.`, `version.channels[${index}].countdownEnabled`, 'WARNING'));
      }
    });
  }

  _validateRules(campaignCode, version, rules, errors, warnings) {
    const ruleMap = new Map();
    for (const rule of rules) {
      if (rule && rule.ruleType) ruleMap.set(rule.ruleType, normalizeRuleValue(rule.value));
    }

    if (campaignCode === 'HAPPY_HOUR') {
      if (version.benefitType !== 'PERCENT_DISCOUNT' || Number(version.benefitValue) !== 20) {
        errors.push(issue('HAPPY_HOUR_DISCOUNT_MUST_BE_20', 'HAPPY_HOUR v1 must use a 20% percentage discount.', 'version.benefitValue'));
      }

      for (const [ruleType, expected] of REQUIRED_HAPPY_HOUR_RULES.entries()) {
        if (ruleMap.get(ruleType) !== expected) {
          errors.push(issue('HAPPY_HOUR_REQUIRED_RULE_MISSING', `${ruleType} must be ${expected}.`, `version.rules.${ruleType}`, 'ERROR', { expected }));
        }
      }

      const enabledChannels = (version.channels || []).filter((item) => item.enabled !== false);
      const withoutCountdown = enabledChannels.filter((item) => item.countdownEnabled !== true).map((item) => item.channel);
      if (withoutCountdown.length > 0) {
        errors.push(issue('HAPPY_HOUR_COUNTDOWN_REQUIRED', 'Countdown is mandatory in every enabled HAPPY_HOUR channel.', 'version.channels', 'ERROR', { channels: withoutCountdown }));
      }

      if (version.priceLockSeconds !== 300) {
        warnings.push(issue('HAPPY_HOUR_PRICE_LOCK_NONSTANDARD', 'HAPPY_HOUR v1 is designed for a 300-second price lock.', 'version.priceLockSeconds', 'WARNING'));
      }
    }
  }

  _result(errors, warnings) {
    return {
      valid: errors.length === 0,
      nextStatus: errors.length === 0 ? 'READY' : 'VALIDATION_FAILED',
      errors,
      warnings,
    };
  }
}

module.exports = {
  PromotionValidationService,
  CAMPAIGN_STATUSES,
  BENEFIT_TYPES,
  CHANNELS,
};
