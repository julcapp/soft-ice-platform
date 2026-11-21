const {
  PHOTO_VERIFICATION_MODES,
  PHOTO_VERIFICATION_DECISIONS,
} = require('./constants');

class PhotoVerificationAgent {
  constructor({
    mode = PHOTO_VERIFICATION_MODES.AI_ASSISTED,
    provider,
    approvalThreshold = 0.9,
    rejectionThreshold = 0.65,
    maxFraudScore = 0.5,
  } = {}) {
    if (!Object.values(PHOTO_VERIFICATION_MODES).includes(mode)) {
      throw new Error('Unsupported photo verification mode');
    }

    if (mode === PHOTO_VERIFICATION_MODES.AI_ASSISTED && !provider) {
      throw new Error('Vision provider is required in ai_assisted mode');
    }

    this.mode = mode;
    this.provider = provider;
    this.approvalThreshold = approvalThreshold;
    this.rejectionThreshold = rejectionThreshold;
    this.maxFraudScore = maxFraudScore;
  }

  async verify(input) {
    const normalizedInput = this.#validateInput(input);

    if (this.mode === PHOTO_VERIFICATION_MODES.DISABLED) {
      return this.#result({
        decision: PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW,
        confidence: 0,
        fraudScore: 0,
        reasonCode: 'service_disabled',
        checks: {},
      });
    }

    if (this.mode === PHOTO_VERIFICATION_MODES.MANUAL_ONLY) {
      return this.#result({
        decision: PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW,
        confidence: 0,
        fraudScore: 0,
        reasonCode: 'manual_only_mode',
        checks: {},
      });
    }

    const providerResult = await this.provider.analyze(normalizedInput);
    return this.#decide(providerResult);
  }

  #validateInput(input) {
    if (!input || typeof input !== 'object') {
      throw new Error('Photo verification input is required');
    }

    if (!input.submissionId) {
      throw new Error('submissionId is required');
    }

    if (!input.customerId) {
      throw new Error('customerId is required');
    }

    if (!input.storageKey) {
      throw new Error('storageKey is required');
    }

    return {
      submissionId: String(input.submissionId),
      customerId: String(input.customerId),
      challengeId: input.challengeId ? String(input.challengeId) : null,
      storageKey: String(input.storageKey),
      rules: input.rules && typeof input.rules === 'object' ? input.rules : {},
      metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
      antifraud: input.antifraud && typeof input.antifraud === 'object' ? input.antifraud : {},
      mockResult: input.mockResult || null,
    };
  }

  #decide(providerResult = {}) {
    const confidence = this.#score(providerResult.confidence);
    const fraudScore = this.#score(providerResult.fraudScore);
    const checks = providerResult.checks || {};

    if (checks.unsafeContent === true) {
      return this.#result({
        ...providerResult,
        decision: PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW,
        confidence,
        fraudScore,
        reasonCode: 'unsafe_content_requires_review',
        checks,
      });
    }

    if (fraudScore > this.maxFraudScore) {
      return this.#result({
        ...providerResult,
        decision: PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW,
        confidence,
        fraudScore,
        reasonCode: 'fraud_score_requires_review',
        checks,
      });
    }

    if (
      providerResult.decision === PHOTO_VERIFICATION_DECISIONS.APPROVED &&
      confidence >= this.approvalThreshold
    ) {
      return this.#result({
        ...providerResult,
        decision: PHOTO_VERIFICATION_DECISIONS.APPROVED,
        confidence,
        fraudScore,
        reasonCode: providerResult.reasonCode || 'challenge_completed',
        checks,
      });
    }

    if (
      providerResult.decision === PHOTO_VERIFICATION_DECISIONS.REJECTED &&
      confidence >= this.rejectionThreshold
    ) {
      return this.#result({
        ...providerResult,
        decision: PHOTO_VERIFICATION_DECISIONS.REJECTED,
        confidence,
        fraudScore,
        reasonCode: providerResult.reasonCode || 'challenge_not_completed',
        checks,
      });
    }

    return this.#result({
      ...providerResult,
      decision: PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW,
      confidence,
      fraudScore,
      reasonCode: providerResult.reasonCode || 'low_confidence',
      checks,
    });
  }

  #score(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.max(0, Math.min(1, numericValue));
  }

  #result(result) {
    return {
      agentVersion: '0.1.0',
      mode: this.mode,
      provider: result.provider || null,
      model: result.model || null,
      decision: result.decision,
      confidence: result.confidence,
      fraudScore: result.fraudScore,
      reasonCode: result.reasonCode,
      checks: result.checks || {},
      processedAt: new Date().toISOString(),
    };
  }
}

module.exports = {
  PhotoVerificationAgent,
};
