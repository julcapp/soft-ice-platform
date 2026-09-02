const crypto = require('node:crypto');
const { REFERRAL_STATUS, assertReferralParticipants, isQualifyingAction } = require('./ReferralPolicy');

function createReferralCode(customerId) {
  if (!customerId) throw new Error('customerId is required.');
  return crypto.createHash('sha256').update(`utimoshi:${customerId}`).digest('base64url').slice(0, 10).toUpperCase();
}

class ReferralService {
  constructor({ repository = null, eventCenter = null } = {}) {
    this.repository = repository;
    this.eventCenter = eventCenter;
  }

  getInviteProfile(customerId) {
    const code = createReferralCode(customerId);
    return { customerId, referralCode: code, startPayload: `ref_${code}` };
  }

  async registerReferral({ referrerCustomerId, referredCustomerId, referralCode, sourceChannel = null }) {
    assertReferralParticipants({ referrerCustomerId, referredCustomerId });
    const existing = this.repository?.findByReferredCustomerId
      ? await this.repository.findByReferredCustomerId(referredCustomerId)
      : null;
    if (existing) return existing;

    const record = {
      referrerCustomerId,
      referredCustomerId,
      referralCode,
      sourceChannel,
      status: REFERRAL_STATUS.REGISTERED,
    };
    const saved = this.repository?.create ? await this.repository.create(record) : record;
    await this.publish('REFERRAL_REGISTERED', saved);
    return saved;
  }

  async qualify({ referral, action, eventId = null, occurredAt = new Date().toISOString() }) {
    if (!isQualifyingAction(action)) return { ...referral, qualified: false };
    if ([REFERRAL_STATUS.QUALIFIED, REFERRAL_STATUS.REWARDED].includes(referral.status)) {
      return { ...referral, qualified: true, duplicate: true };
    }

    if (this.repository?.recordQualification && referral.id) {
      const persisted = await this.repository.recordQualification({
        referralId: referral.id,
        action,
        sourceEventId: eventId,
        occurredAt: new Date(occurredAt),
      });
      if (persisted && persisted.action !== action) {
        return { ...referral, qualified: true, duplicate: true, qualifyingAction: persisted.action };
      }
    }

    const update = { status: REFERRAL_STATUS.QUALIFIED, qualifyingAction: action, qualifyingEventId: eventId, qualifiedAt: occurredAt };
    const saved = this.repository?.update ? await this.repository.update(referral.id, update) : { ...referral, ...update };
    await this.publish('REFERRAL_QUALIFIED', { ...saved, qualifyingAction: action, qualifyingEventId: eventId, qualifiedAt: occurredAt });
    return { ...saved, qualifyingAction: action, qualifyingEventId: eventId, qualifiedAt: occurredAt, qualified: true };
  }

  async markRewarded(referral, reward = {}) {
    if (referral.status !== REFERRAL_STATUS.QUALIFIED) return referral;
    const update = { status: REFERRAL_STATUS.REWARDED, rewardedAt: new Date().toISOString(), reward };
    const saved = this.repository?.update ? await this.repository.update(referral.id, update) : { ...referral, ...update };
    await this.publish('REFERRAL_REWARDED', saved);
    return saved;
  }

  async publish(type, payload) {
    if (!this.eventCenter) return;
    if (typeof this.eventCenter.publish === 'function') return this.eventCenter.publish({ type, payload });
    if (typeof this.eventCenter.emit === 'function') return this.eventCenter.emit(type, payload);
  }
}

module.exports = { ReferralService, createReferralCode };
