const { QUALIFYING_ACTION } = require('./ReferralPolicy');

class ReferralEventOrchestrator {
  constructor({ referralRepository, referralService, rewardEngine, welcomeBonusService = null, qualifiedTopupThresholdRub = 0 } = {}) {
    this.referralRepository = referralRepository;
    this.referralService = referralService;
    this.rewardEngine = rewardEngine;
    this.welcomeBonusService = welcomeBonusService;
    this.qualifiedTopupThresholdRub = Number(qualifiedTopupThresholdRub || 0);
  }

  async onOrderPaid({ customerId, orderId, occurredAt = new Date().toISOString(), reward = {} }) {
    if (!customerId || !orderId) return { applied: false, reason: 'missing_context' };
    const referral = await this.referralRepository.findByReferredCustomerId(customerId);
    if (!referral) return { applied: false, reason: 'no_referral' };

    const qualified = await this.referralService.qualify({
      referral,
      action: QUALIFYING_ACTION.FIRST_PURCHASE,
      eventId: orderId,
      occurredAt,
    });
    if (!qualified.qualified) return { applied: false, reason: 'not_qualified' };

    const rewarded = await this.rewardEngine.rewardQualifiedReferral({
      referral: qualified,
      referrerAmountBonus: Number(reward.referrerAmountBonus || 0),
      referredAmountBonus: Number(reward.referredAmountBonus || 0),
    });
    await this.welcomeBonusService?.qualify({ customerId: referral.referrerCustomerId, action: 'referral_qualified', eventId: referral.id });
    return { applied: true, action: QUALIFYING_ACTION.FIRST_PURCHASE, referral: rewarded };
  }

  async onClubTopupCredited({ customerId, transactionId, amountRub, balanceAfterRub = null, occurredAt = new Date().toISOString(), reward = {} }) {
    if (!customerId || !transactionId) return { applied: false, reason: 'missing_context' };
    const threshold = this.qualifiedTopupThresholdRub;
    const qualifyingValue = balanceAfterRub == null ? Number(amountRub || 0) : Number(balanceAfterRub || 0);
    if (threshold > 0 && qualifyingValue < threshold) return { applied: false, reason: 'below_threshold' };

    await this.welcomeBonusService?.qualify({ customerId, action: 'repeat_club_topup', eventId: transactionId });

    const referral = await this.referralRepository.findByReferredCustomerId(customerId);
    if (!referral) return { applied: false, reason: 'no_referral', welcomeBonusChecked: true };
    const qualified = await this.referralService.qualify({
      referral,
      action: QUALIFYING_ACTION.QUALIFIED_CLUB_TOPUP,
      eventId: transactionId,
      occurredAt,
    });
    if (!qualified.qualified) return { applied: false, reason: 'not_qualified' };
    const rewarded = await this.rewardEngine.rewardQualifiedReferral({
      referral: qualified,
      referrerAmountBonus: Number(reward.referrerAmountBonus || 0),
      referredAmountBonus: Number(reward.referredAmountBonus || 0),
    });
    await this.welcomeBonusService?.qualify({ customerId: referral.referrerCustomerId, action: 'referral_qualified', eventId: referral.id });
    return { applied: true, action: QUALIFYING_ACTION.QUALIFIED_CLUB_TOPUP, referral: rewarded };
  }
}

module.exports = { ReferralEventOrchestrator };
