const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PhotoVerificationAgent,
  MockVisionProvider,
  PHOTO_VERIFICATION_MODES,
  PHOTO_VERIFICATION_DECISIONS,
} = require('../src/modules/photo_verification');

const baseInput = {
  submissionId: 'submission-1',
  customerId: 'customer-1',
  storageKey: 'photos/submission-1.jpg',
  rules: {
    iceCreamRequired: true,
  },
};

test('disabled mode routes photo to manual review', async () => {
  const agent = new PhotoVerificationAgent({
    mode: PHOTO_VERIFICATION_MODES.DISABLED,
  });

  const result = await agent.verify(baseInput);

  assert.equal(result.decision, PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW);
  assert.equal(result.reasonCode, 'service_disabled');
});

test('manual-only mode never invokes AI decision', async () => {
  const agent = new PhotoVerificationAgent({
    mode: PHOTO_VERIFICATION_MODES.MANUAL_ONLY,
  });

  const result = await agent.verify(baseInput);

  assert.equal(result.decision, PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW);
  assert.equal(result.reasonCode, 'manual_only_mode');
});

test('high-confidence approved result is approved', async () => {
  const provider = new MockVisionProvider();
  const agent = new PhotoVerificationAgent({ provider });

  const result = await agent.verify({
    ...baseInput,
    mockResult: {
      decision: PHOTO_VERIFICATION_DECISIONS.APPROVED,
      confidence: 0.96,
      fraudScore: 0.08,
      reasonCode: 'challenge_completed',
      checks: {
        iceCreamPresent: true,
      },
    },
  });

  assert.equal(result.decision, PHOTO_VERIFICATION_DECISIONS.APPROVED);
  assert.equal(result.confidence, 0.96);
});

test('high fraud score always requires manual review', async () => {
  const provider = new MockVisionProvider();
  const agent = new PhotoVerificationAgent({ provider, maxFraudScore: 0.5 });

  const result = await agent.verify({
    ...baseInput,
    mockResult: {
      decision: PHOTO_VERIFICATION_DECISIONS.APPROVED,
      confidence: 0.99,
      fraudScore: 0.8,
      checks: {
        iceCreamPresent: true,
      },
    },
  });

  assert.equal(result.decision, PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW);
  assert.equal(result.reasonCode, 'fraud_score_requires_review');
});

test('unsafe content always requires manual review', async () => {
  const provider = new MockVisionProvider();
  const agent = new PhotoVerificationAgent({ provider });

  const result = await agent.verify({
    ...baseInput,
    mockResult: {
      decision: PHOTO_VERIFICATION_DECISIONS.APPROVED,
      confidence: 0.99,
      fraudScore: 0,
      checks: {
        unsafeContent: true,
      },
    },
  });

  assert.equal(result.decision, PHOTO_VERIFICATION_DECISIONS.MANUAL_REVIEW);
  assert.equal(result.reasonCode, 'unsafe_content_requires_review');
});
