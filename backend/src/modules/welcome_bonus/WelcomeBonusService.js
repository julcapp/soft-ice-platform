const crypto = require('node:crypto');
const {
  WELCOME_BONUS_STATUS,
  DEFAULT_VALID_DAYS,
  addDays,
  isWelcomeBonusQualifyingAction,
} = require('./WelcomeBonusPolicy');

class WelcomeBonusService {
  constructor({ repository, eventCenter = null, clock = () => new Date(), validDays = DEFAULT_VALID_DAYS } = {}) {
    this.repository = repository;
    this.eventCenter = eventCenter;
    this.clock = clock;
    this.validDays = validDays;
  }

  async issue({ customerId, amountBonus, metadata = null }) {
    if (!customerId || !Number.isInteger(amountBonus) || amountBonus <= 0) {
      throw new Error('customerId and positive integer amountBonus are required.');
    }
    const existing = await this.repository.findActiveByCustomerId(customerId);
    if (existing) return existing;

    const issuedAt = this.clock();
    const grant = await this.repository.create({
      id: crypto.randomUUID(),
      customerId,
      amountGranted: amountBonus,
      amountRemaining: amountBonus,
      status: WELCOME_BONUS_STATUS.ACTIVE,
      issuedAt,
      expiresAt: addDays(issuedAt, this.validDays),
      metadata,
    });
    await this.publish('WELCOME_BONUS_ISSUED', grant);
    return grant;
  }

  async qualify({ customerId, action, eventId = null }) {
    if (!isWelcomeBonusQualifyingAction(action)) return null;
    const grant = await this.repository.findActiveByCustomerId(customerId);
    if (!grant || grant.status !== WELCOME_BONUS_STATUS.ACTIVE) return grant;

    const now = this.clock();
    if (new Date(grant.expiresAt).getTime() <= now.getTime()) {
      await this.repository.expireDue(now);
      return null;
    }

    const qualified = await this.repository.qualify(grant.id, {
      action,
      eventId,
      qualifiedAt: now,
    });
    await this.publish('WELCOME_BONUS_QUALIFIED', qualified);
    return qualified;
  }

  async expireDue() {
    const expired = await this.repository.expireDue(this.clock());
    for (const grant of expired) await this.publish('WELCOME_BONUS_EXPIRED', grant);
    return expired;
  }

  async publish(type, payload) {
    if (!this.eventCenter) return;
    if (typeof this.eventCenter.publish === 'function') return this.eventCenter.publish({ type, payload });
    if (typeof this.eventCenter.emit === 'function') return this.eventCenter.emit(type, payload);
  }
}

module.exports = { WelcomeBonusService };
