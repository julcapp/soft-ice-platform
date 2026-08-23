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
  'BONUS_PAYMENT',
  'FREE_ADDON',
  'PERSONAL_OFFER',
]);

const CHANNELS = new Set(['TERMINAL', 'WEB', 'MINI_APP', 'TELEGRAM', 'MAX', 'VK']);
const APPROVAL_POLICIES = new Set(['NONE', 'SINGLE_APPROVAL', 'DUAL_APPROVAL', 'OWNER_APPROVAL']);
const STACKING_MODES = new Set(['BEST_PRICE', 'EXCLUSIVE', 'STACKABLE']);
const BUDGET_ACTIONS = new Set(['STOP', 'NOTIFY_ONLY']);

const REQUIRED_HAPPY_HOUR_RULES = new Map([
  ['PARTIAL_BONUS_PAYMENT', 'FORBIDDEN'],
  ['TRANSFER_TO_THIRD_PARTY', 'FORBIDDEN'],
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
      errors.push(issue('INVALID_PRICE_LOCK', 'priceLockSeconds must be a positive integer.', 'version.priceLockSeconds'));
    }

    if (version.startsAt && version.endsAt && new Date(version.startsAt) >= new Date(version.endsAt)) {
      errors.push(issue('INVALID_DATE_RANGE', 'startsAt must be earlier than endsAt.', 'version.startsAt'));
    }

    if (version.minimumFinalPrice !== null && version.minimumFinalPrice !== undefined && Number(version.minimumFinalPrice) < 0) {
      errors.push(issue('INVALID_MINIMUM_FINAL_PRICE', 'minimumFinalPrice cannot be negative.', 'version.minimumFinalPrice'));
    }

    if (version.budgetAmount !== null && version.budgetAmount !== undefined && Number(version.budgetAmount) < 0) {
      errors.push(issue('INVALID_BUDGET', 'budgetAmount cannot be negative.', 'version.budgetAmount'));
    }

    if (!version.timezone || !String(version.timezone).trim()) {
      errors.push(issue('TIMEZONE_REQUIRED', 'Promotion timezone is required.', 'version.timezone'));
    } else {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: version.timezone }).format(new Date());
      } catch (_error) {
        errors.push(issue('INVALID_TIMEZONE', 'Promotion timezone is invalid.', 'version.timezone'));
      }
    }

    if (version.priceLockSeconds !== 300) {
      warnings.push(issue('NON_STANDARD_PRICE_LOCK', 'Recommended price lock is 300 seconds.', 'version.priceLockSeconds', 'WARNING'));
    }
  }

  _validateSchedule(schedules, errors, warnings) {
    const enabled = schedules.filter((item) => item.isEnabled !== false);
    if (enabled.length === 0) {
      errors.push(issue('SCHEDULE_REQUIRED', 'At least one enabled schedule window is required.', 'version.schedules'));
      return;
    }

    const byDay = new Map();
    enabled.forEach((schedule, index) => {
      const path = `version.schedules[${index}]`;
      if (!Number.isInteger(schedule.dayOfWeek) || schedule.dayOfWeek < 1 || schedule.dayOfWeek > 7) {
        errors.push(issue('INVALID_DAY_OF_WEEK', 'dayOfWeek must be an integer from 1 to 7.', `${path}.dayOfWeek`));
        return;
      }
      const start = toMinutes(schedule.startTime);
      const end = toMinutes(schedule.endTime);
      if (start === null || end === null) {
        errors.push(issue('INVALID_SCHEDULE_TIME', 'Schedule times must use HH:MM or HH:MM:SS.', path));
        return;
      }
      if (start >= end) {
        errors.push(issue('INVALID_SCHEDULE_WINDOW', 'Schedule start time must be earlier than end time.', path));
        return;
      }
      if (!byDay.has(schedule.dayOfWeek)) byDay.set(schedule.dayOfWeek, []);
      byDay.get(schedule.dayOfWeek).push({ start, end, path });
    });

    for (const windows of byDay.values()) {
      windows.sort((a, b) => a.start - b.start);
      for (let i = 1; i < windows.length; i += 1) {
        if (windows[i].start < windows[i - 1].end) {
          errors.push(issue('OVERLAPPING_SCHEDULE_WINDOWS', 'Schedule windows cannot overlap.', windows[i].path));
        }
      }
    }

    if (enabled.length > 14) {
      warnings.push(issue('COMPLEX_SCHEDULE', 'Promotion has many schedule windows; verify the configuration.', 'version.schedules', 'WARNING'));
    }
  }

  _validateTargets(targets, errors) {
    if (targets.length === 0) {
      errors.push(issue('TARGET_REQUIRED', 'At least one promotion target is required.', 'version.targets'));
      return;
    }
    targets.forEach((target, index) => {
      if (!target.targetType) {
        errors.push(issue('TARGET_TYPE_REQUIRED', 'targetType is required.', `version.targets[${index}].targetType`));
      }
      if (target.targetType !== 'ALL_MACHINES' && !target.targetId) {
        errors.push(issue('TARGET_ID_REQUIRED', 'targetId is required for this target type.', `version.targets[${index}].targetId`));
      }
    });
  }

  _validateAudiences(audiences, errors) {
    if (audiences.length === 0) {
      errors.push(issue('AUDIENCE_REQUIRED', 'At least one promotion audience is required.', 'version.audiences'));
    }
  }

  _validateChannels(channels, errors, warnings) {
    const enabled = channels.filter((item) => item.enabled !== false);
    if (enabled.length === 0) {
      errors.push(issue('CHANNEL_REQUIRED', 'At least one enabled channel is required.', 'version.channels'));
      return;
    }
    enabled.forEach((channel, index) => {
      if (!CHANNELS.has(channel.channel)) {
        errors.push(issue('INVALID_CHANNEL', `Unsupported channel: ${channel.channel}.`, `version.channels[${index}].channel`));
      }
      if (channel.countdownEnabled === false) {
        warnings.push(issue('COUNTDOWN_DISABLED', 'Countdown is disabled for an enabled channel.', `version.channels[${index}].countdownEnabled`, 'WARNING'));
      }
    });
  }

  _validateRules(campaignCode, version, rules, errors) {
    if (campaignCode !== 'HAPPY_HOUR') return;

    if (version.benefitType !== 'PERCENT_DISCOUNT' || Number(version.benefitValue) !== 20) {
      errors.push(issue('HAPPY_HOUR_DISCOUNT_MUST_BE_20', 'HAPPY_HOUR v1 must use a 20% discount.', 'version.benefitValue'));
    }

    for (const [ruleType, requiredValue] of REQUIRED_HAPPY_HOUR_RULES.entries()) {
      const rule = rules.find((item) => item.ruleType === ruleType);
      const actual = normalizeRuleValue(rule && rule.value);
      if (actual !== requiredValue) {
        errors.push(issue('HAPPY_HOUR_REQUIRED_RULE_MISSING', `${ruleType} must equal ${requiredValue}.`, `version.rules.${ruleType}`));
      }
    }

    (version.channels || []).filter((item) => item.enabled !== false).forEach((channel) => {
      if (channel.countdownEnabled !== true) {
        errors.push(issue('HAPPY_HOUR_COUNTDOWN_REQUIRED', 'Countdown is mandatory in every enabled HAPPY_HOUR channel.', `version.channels.${channel.channel}.countdownEnabled`));
      }
    });
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
  APPROVAL_POLICIES,
  STACKING_MODES,
  BUDGET_ACTIONS,
  REQUIRED_HAPPY_HOUR_RULES,
};
