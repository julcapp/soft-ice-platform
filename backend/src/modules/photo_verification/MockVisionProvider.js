const { PHOTO_VERIFICATION_DECISIONS } = require('./constants');

class MockVisionProvider {
  constructor(options = {}) {
    this.name = 'mock';
    this.model = options.model || 'photo-verification-mock-v0.1';
  }

  async analyze({ rules = {}, mockResult = null }) {
    if (mockResult) {
      return {
        provider: this.name,
        model: this.model,
        ...mockResult,
      };
    }

    return {
      provider: this.name,
      model: this.model,
      decision: PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW,
      confidence: 0,
      fraudScore: 0,
      reasonCode: 'mock_provider_no_result',
      checks: {
        rulesReceived: Object.keys(rules).length > 0,
      },
    };
  }
}

module.exports = {
  MockVisionProvider,
};
