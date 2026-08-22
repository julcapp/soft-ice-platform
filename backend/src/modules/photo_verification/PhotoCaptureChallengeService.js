const crypto = require('node:crypto');

class PhotoCaptureChallengeService {
  constructor({ repository, secret, ttlSeconds = 180, clock = () => new Date(), randomInt = crypto.randomInt } = {}) {
    if (!repository) throw new Error('repository is required');
    this.repository = repository;
    this.secret = secret || null;
    this.ttlSeconds = Math.max(60, Math.min(600, Number(ttlSeconds) || 180));
    this.clock = clock;
    this.randomInt = randomInt;
  }

  async issue({ photoChallengeId, customerId, correlationId = null }) {
    this.#assertConfigured();
    const code = `ТИМОША-${String(this.randomInt(0, 1000000)).padStart(6, '0')}`;
    const issuedAt = this.clock();
    const expiresAt = new Date(issuedAt.getTime() + this.ttlSeconds * 1000);
    const tokenHash = this.#hash({ photoChallengeId, customerId, code });
    await this.repository.issueCaptureChallenge({
      photoChallengeId,
      customerId,
      tokenHash,
      issuedAt,
      expiresAt,
      correlationId,
    });
    return { required: true, code, expiresAt };
  }

  async verify({ photoChallengeId, customerId, code }) {
    this.#assertConfigured();
    if (!code) return { valid: false, reasonCode: 'PHOTO_CAPTURE_CODE_REQUIRED' };
    const active = await this.repository.findActiveCaptureChallenge({ photoChallengeId, customerId, now: this.clock() });
    if (!active) return { valid: false, reasonCode: 'PHOTO_CAPTURE_CODE_EXPIRED_OR_USED' };
    const expected = Buffer.from(active.tokenHash, 'hex');
    const actual = Buffer.from(this.#hash({ photoChallengeId, customerId, code }), 'hex');
    const valid = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    return valid
      ? { valid: true, issuedEventId: active.id, expiresAt: active.expiresAt }
      : { valid: false, reasonCode: 'PHOTO_CAPTURE_CODE_INVALID' };
  }

  async consume({ photoChallengeId, customerId, issuedEventId, correlationId = null }) {
    await this.repository.consumeCaptureChallenge({ photoChallengeId, customerId, issuedEventId, correlationId });
  }

  #hash({ photoChallengeId, customerId, code }) {
    return crypto.createHmac('sha256', this.secret)
      .update(`${photoChallengeId}:${customerId}:${String(code).trim().toUpperCase()}`)
      .digest('hex');
  }

  #assertConfigured() {
    if (!this.secret) {
      const error = new Error('Photo capture challenge secret is not configured');
      error.code = 'PHOTO_CAPTURE_CHALLENGE_SECRET_NOT_CONFIGURED';
      error.statusCode = 503;
      throw error;
    }
  }
}

module.exports = { PhotoCaptureChallengeService };
