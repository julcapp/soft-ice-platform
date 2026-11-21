'use strict';

function safetyIssue(code, message, severity = 'CRITICAL', metadata = {}) {
  return { code, message, severity, metadata };
}

class PromotionSafetyService {
  constructor({ repository } = {}) {
    if (!repository) throw new Error('Promotion repository is required.');
    this.repository = repository;
  }

  async evaluate({ campaign, observedFinalPrice = null, observedDiscountPercent = null }) {
    if (!campaign?.currentVersion) throw new Error('Promotion campaign with currentVersion is required.');

    const version = campaign.currentVersion;
    const usage = await this.repository.getUsageSummary(version.id);
    const issues = [];

    const minimumFinalPrice = version.minimumFinalPrice == null ? null : Number(version.minimumFinalPrice);
    if (minimumFinalPrice !== null && observedFinalPrice !== null && Number(observedFinalPrice) < minimumFinalPrice) {
      issues.push(safetyIssue(
        'PROMOTION_MINIMUM_PRICE_BREACH',
        'Observed final price is below the configured minimum final price.',
        'CRITICAL',
        { minimumFinalPrice, observedFinalPrice: Number(observedFinalPrice) },
      ));
    }

    if (observedDiscountPercent !== null && version.benefitType === 'PERCENT_DISCOUNT') {
      const configured = Number(version.benefitValue);
      const observed = Number(observedDiscountPercent);
      if (Number.isFinite(observed) && observed > configured) {
        issues.push(safetyIssue(
          'PROMOTION_DISCOUNT_EXCEEDS_CONFIGURED',
          'Observed percentage discount exceeds the configured campaign discount.',
          'CRITICAL',
          { configuredDiscountPercent: configured, observedDiscountPercent: observed },
        ));
      }
    }

    const budgetAmount = version.budgetAmount == null ? null : Number(version.budgetAmount);
    if (budgetAmount !== null && usage.discountAmount >= budgetAmount) {
      issues.push(safetyIssue(
        'PROMOTION_BUDGET_REACHED',
        'Promotion discount budget has reached or exceeded its configured limit.',
        version.budgetAction === 'STOP' ? 'CRITICAL' : 'WARNING',
        { budgetAmount, discountAmount: usage.discountAmount, budgetAction: version.budgetAction },
      ));
    }

    if (version.maxApplications != null && usage.applications >= Number(version.maxApplications)) {
      issues.push(safetyIssue(
        'PROMOTION_MAX_APPLICATIONS_REACHED',
        'Promotion application limit has been reached.',
        'CRITICAL',
        { maxApplications: Number(version.maxApplications), applications: usage.applications },
      ));
    }

    const budgetStop = issues.some((item) => item.code === 'PROMOTION_BUDGET_REACHED' && version.budgetAction === 'STOP');
    const safetyStop = issues.some((item) => item.severity === 'CRITICAL' && item.code !== 'PROMOTION_BUDGET_REACHED');

    return {
      safe: !budgetStop && !safetyStop,
      recommendedStatus: budgetStop ? 'PAUSED_BY_BUDGET' : safetyStop ? 'PAUSED_BY_SAFETY' : campaign.status,
      usage,
      issues,
      checkedAt: new Date().toISOString(),
    };
  }
}

module.exports = { PromotionSafetyService, safetyIssue };
