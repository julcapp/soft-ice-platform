const { REFERRAL_STATUS } = require('./ReferralPolicy');

class ReferralRewardEngine {
  constructor({ referralRepository, bonusLedger, eventCenter = null, clock = () => new Date() } = {}) {
    this.referralRepository = referralRepository;
    this.bonusLedger = bonusLedger;
    this.eventCenter = eventCenter;
    this.clock = clock;
  }

  async rewardQualifiedReferral({ referral, referrerAmountBonus, referredAmountBonus }) {
    if (!referral || referral.status !== REFERRAL_STATUS.QUALIFIED) return referral;
    if (!this.bonusLedger || typeof this.bonusLedger.credit !== 'function') {
      throw new Error('bonusLedger.credit is required.');
    }

    const reference = `referral:${referral.id}`;
    if (!referral.referrerBonusPaid && referrerAmountBonus > 0) {
      await this.bonusLedger.credit({
        customerId: referral.referrerCustomerId,
        amountBonus: referrerAmountBonus,
        type: 'REFERRAL_REWARD_REFERRER',
        referralId: referral.id,
        referenceEntityType: 'Referral',
        referenceEntityId: referral.id,
        idempotencyKey: `${reference}:referrer`,
      });
    }

    if (!referral.referredBonusPaid && referral.referredCustomerId && referredAmountBonus > 0) {
      await this.bonusLedger.credit({
        customerId: referral.referredCustomerId,
        amountBonus: referredAmountBonus,
        type: 'REFERRAL_REWARD_REFERRED',
        referralId: referral.id,
        referenceEntityType: 'Referral',
        referenceEntityId: referral.id,
        idempotencyKey: `${reference}:referred`,
      });
    }

    const saved = this.referralRepository?.markRewardPaid
      ? await this.referralRepository.markRewardPaid(referral.id, {
          referrerBonusPaid: referrerAmountBonus > 0 || referral.referrerBonusPaid,
          referredBonusPaid: referredAmountBonus > 0 || referral.referredBonusPaid,
          status: REFERRAL_STATUS.REWARDED,
        })
      : { ...referral, status: REFERRAL_STATUS.REWARDED, referrerBonusPaid: true, referredBonusPaid: true };

    await this.publish('REFERRAL_REWARDED', { ...saved, rewardedAt: this.clock().toISOString() });
    return saved;
  }

  async publish(type, payload) {
    if (!this.eventCenter) return;
    if (typeof this.eventCenter.publish === 'function') return this.eventCenter.publish({ type, payload });
    if (typeof this.eventCenter.emit === 'function') return this.eventCenter.emit(type, payload);
  }
}

module.exports = { ReferralRewardEngine };
