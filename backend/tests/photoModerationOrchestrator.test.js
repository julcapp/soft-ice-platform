const test = require('node:test');
const assert = require('node:assert/strict');
const { PhotoModerationOrchestrator } = require('../src/modules/photo_verification/PhotoModerationOrchestrator');

function baseDependencies({ rewardGranted = false } = {}) {
  const calls = [];
  const repository = {
    async getSettings() { return { enabled: true, mode: 'manual_only', publishingEnabled: true, retentionPolicy: 'delete_after_publication' }; },
    async recordEvent(event) { calls.push(['event', event.eventType]); },
  };
  return {
    calls,
    repository,
    storage: {
      async get() { calls.push(['storage.get']); return Buffer.from('photo'); },
      async delete() { calls.push(['storage.delete']); return { deleted: true }; },
    },
    technicalAnalyzer: {
      async analyze() { calls.push(['technical']); return { metadataResult: {}, duplicateResult: { duplicate: false, nearDuplicate: false }, fingerprint: {} }; },
    },
    customerWorkflow: {
      async handleDuplicateCheck() { return { stopBeforeVision: false }; },
      async recordModerationDecision() { calls.push(['customer.moderation']); return { status: 'additional_review' }; },
      async recordPublished() { calls.push(['customer.published']); },
      async recordRewarded() { calls.push(['customer.rewarded']); return { status: 'rewarded' }; },
    },
    moderationLifecycle: {
      async recordModerationResult() { calls.push(['moderation.result']); },
      async recordSourceDeletion() { calls.push(['deletion.evidence']); },
    },
    publishingOrchestrator: {
      async publishAll() { calls.push(['publishing']); return { allRequiredPublished: true, results: [{ channel: 'VK', status: 'published', publicationUrl: 'https://example.test/post' }] }; },
    },
    rewardEngine: {
      async grant() {
        calls.push(['reward']);
        return rewardGranted
          ? { granted: true, transactionId: 'bonus-tx-1', amountBonus: 50, balanceAfterBonus: 150 }
          : { granted: false, reasonCode: 'NOT_CONFIGURED' };
      },
    },
  };
}

test('manual_only routes to manual review without publishing or reward', async () => {
  const deps = baseDependencies();
  const orchestrator = new PhotoModerationOrchestrator(deps);
  const result = await orchestrator.process({ photoChallengeId: 'p1', customerId: 'c1', storageKey: 'c1/p1/a.jpg' });
  assert.equal(result.stage, 'manual_review');
  assert.equal(deps.calls.some(([name]) => name === 'publishing'), false);
  assert.equal(deps.calls.some(([name]) => name === 'reward'), false);
});

test('approved publication keeps source when reward engine does not grant', async () => {
  const deps = baseDependencies({ rewardGranted: false });
  deps.repository.getSettings = async () => ({ enabled: true, mode: 'ai_assisted', publishingEnabled: true, retentionPolicy: 'delete_after_publication', approvalThreshold: 0.9, rejectionThreshold: 0.65, maxFraudScore: 0.5 });
  const orchestrator = new PhotoModerationOrchestrator({ ...deps, visionProvider: { async analyze() { return { decision: 'approved', confidence: 0.99, fraudScore: 0, checks: {} }; } } });
  const result = await orchestrator.process({ photoChallengeId: 'p1', customerId: 'c1', storageKey: 'c1/p1/a.jpg' });
  assert.equal(result.stage, 'reward_pending');
  assert.equal(deps.calls.some(([name]) => name === 'customer.rewarded'), false);
  assert.equal(deps.calls.some(([name]) => name === 'storage.delete'), false);
});

test('source deletion occurs only after publication, reward and rewarded customer state', async () => {
  const deps = baseDependencies({ rewardGranted: true });
  deps.repository.getSettings = async () => ({ enabled: true, mode: 'ai_assisted', publishingEnabled: true, retentionPolicy: 'delete_after_publication', approvalThreshold: 0.9, rejectionThreshold: 0.65, maxFraudScore: 0.5 });
  const orchestrator = new PhotoModerationOrchestrator({ ...deps, visionProvider: { async analyze() { return { decision: 'approved', confidence: 0.99, fraudScore: 0, checks: {} }; } } });
  const result = await orchestrator.process({ photoChallengeId: 'p1', customerId: 'c1', storageKey: 'c1/p1/a.jpg' });
  assert.equal(result.stage, 'completed');
  assert.equal(result.rewardStatus.status, 'rewarded');
  const order = deps.calls.map(([name]) => name);
  assert.ok(order.indexOf('publishing') < order.indexOf('reward'));
  assert.ok(order.indexOf('reward') < order.indexOf('customer.rewarded'));
  assert.ok(order.indexOf('customer.rewarded') < order.indexOf('storage.delete'));
  assert.ok(order.indexOf('storage.delete') < order.indexOf('deletion.evidence'));
});
