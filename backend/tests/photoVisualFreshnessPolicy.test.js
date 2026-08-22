const test = require('node:test');
const assert = require('node:assert/strict');
const { PhotoModerationOrchestrator } = require('../src/modules/photo_verification/PhotoModerationOrchestrator');

function dependencies({ matches }) {
  const calls = [];
  return {
    calls,
    repository: {
      async getSettings() {
        return {
          enabled: true,
          mode: 'ai_assisted',
          publishingEnabled: true,
          challengeCodeEnabled: true,
          retentionPolicy: 'delete_after_publication',
          approvalThreshold: 0.9,
          rejectionThreshold: 0.65,
          maxFraudScore: 0.5,
          requiredChannels: ['VK', 'TELEGRAM', 'MAX'],
        };
      },
      async recordEvent(event) { calls.push(['event', event.eventType, event.payload]); },
    },
    storage: { async get() { return Buffer.from('photo'); }, async delete() { calls.push(['delete']); } },
    technicalAnalyzer: {
      async analyze() {
        return { metadataResult: {}, duplicateResult: { duplicate: false, nearDuplicate: false }, fingerprint: {} };
      },
    },
    customerWorkflow: {
      async handleDuplicateCheck() { return { stopBeforeVision: false }; },
      async recordModerationDecision(input) { calls.push(['decision', input.decision, input.reasonCode]); return { status: input.decision }; },
      async recordPublished() { calls.push(['published']); },
      async recordRewarded() { calls.push(['rewarded']); },
    },
    moderationLifecycle: {
      async recordModerationResult({ result }) { calls.push(['moderation', result.decision, result.reasonCode, result.checks.captureCodeMatches]); },
      async recordSourceDeletion() { calls.push(['deletionEvidence']); },
    },
    publishingOrchestrator: { async publishAll() { calls.push(['publishing']); return { allRequiredPublished: true, results: [] }; } },
    rewardEngine: { async grant() { calls.push(['reward']); return { granted: true, amountBonus: 1, transactionId: 'tx-1' }; } },
    captureVisualVerifier: {
      async verify({ detectedCaptureCode }) {
        calls.push(['visual', detectedCaptureCode]);
        return { matches, available: true, reasonCode: matches ? null : 'PHOTO_CAPTURE_CODE_VISUAL_MISMATCH' };
      },
    },
    visionProvider: {
      async analyze() {
        return {
          provider: 'test', model: 'test', decision: 'approved', confidence: 0.99, fraudScore: 0,
          reasonCode: 'challenge_completed',
          checks: { captureCodeVisible: true, detectedCaptureCode: 'ТИМОША-483721' },
        };
      },
    },
  };
}

test('visual code mismatch forces manual review and blocks publishing', async () => {
  const deps = dependencies({ matches: false });
  const result = await new PhotoModerationOrchestrator(deps).process({
    photoChallengeId: 'photo-1', customerId: 'customer-1', storageKey: 'photo.jpg',
  });
  assert.equal(result.stage, 'manual_review');
  assert.equal(result.result.checks.captureCodeMatches, false);
  assert.equal(deps.calls.some(([name]) => name === 'publishing'), false);
});

test('matching visual code preserves approved path', async () => {
  const deps = dependencies({ matches: true });
  const result = await new PhotoModerationOrchestrator(deps).process({
    photoChallengeId: 'photo-1', customerId: 'customer-1', storageKey: 'photo.jpg',
  });
  assert.equal(result.stage, 'completed');
  assert.equal(result.result.checks.captureCodeMatches, true);
  assert.equal(deps.calls.some(([name]) => name === 'publishing'), true);
});
