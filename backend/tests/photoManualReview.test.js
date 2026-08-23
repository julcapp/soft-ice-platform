const test = require('node:test');
const assert = require('node:assert/strict');
const { PhotoManualReviewService } = require('../src/modules/photo_verification/PhotoManualReviewService');

const admin = { roles: ['ADMIN'], userId: 'admin-1' };

function fixture(overrides = {}) {
  const calls = [];
  const repository = {
    listManualReviewQueue: async () => [{ photoChallengeId: 'photo-1', decision: 'manual_review' }],
    listManualOperationalCandidates: async () => [],
    getManualReviewItem: async () => ({ photoChallengeId: 'photo-1', customerId: 'customer-1', storageKey: 'c/p/photo.jpg', fraudScore: 0.2, provider: 'manual', decision: 'approved' }),
    getSettings: async () => ({ publishingEnabled: false, requiredChannels: ['VK', 'TELEGRAM', 'MAX'], retentionPolicy: 'delete_after_publication' }),
    claimManualDecision: async () => ({ claimed: true }),
    completeManualDecision: async (input) => calls.push(['decisionCompleted', input]),
    recordEvent: async (input) => calls.push(['event', input]),
    ...overrides.repository,
  };
  const storage = { get: async () => Buffer.from('photo'), delete: async () => calls.push(['delete']), ...overrides.storage };
  const customerWorkflow = {
    recordModerationDecision: async (input) => { calls.push(['customerDecision', input]); return { status: input.decision }; },
    recordPublished: async (input) => calls.push(['published', input]),
    recordRewarded: async (input) => calls.push(['rewarded', input]),
    ...overrides.customerWorkflow,
  };
  const publishingOrchestrator = { publishAll: async () => ({ allRequiredPublished: true, results: [] }), ...overrides.publishingOrchestrator };
  const rewardEngine = { grant: async () => ({ granted: false, reasonCode: 'PHOTO_REWARD_BONUS_UNITS_NOT_CONFIGURED' }), ...overrides.rewardEngine };
  const moderationLifecycle = {
    recordModerationResult: async (input) => calls.push(['moderation', input]),
    recordSourceDeletion: async (input) => calls.push(['sourceDeletion', input]),
    ...overrides.moderationLifecycle,
  };
  return { service: new PhotoManualReviewService({ repository, storage, customerWorkflow, publishingOrchestrator, rewardEngine, moderationLifecycle }), calls };
}

test('manual review queue requires admin role', async () => {
  const { service } = fixture();
  await assert.rejects(() => service.list({ roles: ['USER'] }), (error) => error.code === 'PHOTO_VERIFICATION_ADMIN_PERMISSION_DENIED');
});

test('manual reject requires a reason and never publishes', async () => {
  let publishCalls = 0;
  const { service } = fixture({ publishingOrchestrator: { publishAll: async () => { publishCalls += 1; return {}; } } });
  await assert.rejects(() => service.decide(admin, 'photo-1', { action: 'reject', reason: '' }), (error) => error.code === 'PHOTO_MANUAL_REASON_REQUIRED');
  const result = await service.decide(admin, 'photo-1', { action: 'reject', reason: 'Не соответствует заданию' });
  assert.equal(result.stage, 'rejected');
  assert.equal(publishCalls, 0);
});

test('conflicting second administrator decision is rejected with 409 guard', async () => {
  const { service } = fixture({ repository: { claimManualDecision: async () => ({ claimed: false, conflict: true }) } });
  await assert.rejects(() => service.decide(admin, 'photo-1', { action: 'approve' }), (error) => error.code === 'PHOTO_MANUAL_DECISION_CONFLICT' && error.statusCode === 409);
});

test('same completed manual decision is an idempotent replay', async () => {
  const { service, calls } = fixture({ repository: { claimManualDecision: async () => ({ claimed: false, idempotentReplay: true, processing: false }) } });
  const result = await service.decide(admin, 'photo-1', { action: 'approve' });
  assert.equal(result.stage, 'already_decided');
  assert.equal(calls.length, 0);
});

test('manual approve with publishing disabled records approval but does not publish', async () => {
  let publishCalls = 0;
  const { service, calls } = fixture({ publishingOrchestrator: { publishAll: async () => { publishCalls += 1; return {}; } } });
  const result = await service.decide(admin, 'photo-1', { action: 'approve' });
  assert.equal(result.stage, 'publication_pending');
  assert.equal(publishCalls, 0);
  assert.ok(calls.some(([type, input]) => type === 'moderation' && input.result.provider === 'manual' && input.result.decision === 'approved'));
  assert.ok(calls.some(([type, input]) => type === 'event' && input.eventType === 'manual_moderation_decision' && input.actorId === 'admin-1'));
  assert.ok(calls.some(([type]) => type === 'decisionCompleted'));
});

test('manual approve cannot delete source when reward is not granted', async () => {
  const { service, calls } = fixture({
    repository: { getSettings: async () => ({ publishingEnabled: true, requiredChannels: ['VK'], retentionPolicy: 'delete_after_publication' }) },
    publishingOrchestrator: { publishAll: async () => ({ allRequiredPublished: true, results: [{ channel: 'VK', status: 'published' }] }) },
  });
  const result = await service.decide(admin, 'photo-1', { action: 'approve' });
  assert.equal(result.stage, 'reward_pending');
  assert.equal(calls.some(([type]) => type === 'delete'), false);
});

test('operational queue classifies incomplete publication and retry requires approved manual decision', async () => {
  const { service } = fixture({ repository: {
    getSettings: async () => ({ publishingEnabled: true, requiredChannels: ['VK', 'TELEGRAM'], retentionPolicy: 'delete_after_publication' }),
    listManualOperationalCandidates: async () => [{ photoChallengeId: 'photo-1', publications: [{ channel: 'VK', status: 'published' }], rewardEventType: null, sourceDeletionStatus: null }],
  } });
  const rows = await service.listOperationalIssues(admin);
  assert.equal(rows[0].issueType, 'publication_incomplete');
  assert.deepEqual(rows[0].incompleteChannels, ['TELEGRAM']);
});

test('manual approve follows publication then reward then deletion on success', async () => {
  const sequence = [];
  const { service } = fixture({
    repository: {
      getSettings: async () => ({ publishingEnabled: true, requiredChannels: ['VK'], retentionPolicy: 'delete_after_publication' }),
      recordEvent: async (input) => sequence.push(input.eventType),
      completeManualDecision: async () => sequence.push('decisionCompleted'),
    },
    publishingOrchestrator: { publishAll: async () => { sequence.push('publish'); return { allRequiredPublished: true, results: [] }; } },
    rewardEngine: { grant: async () => { sequence.push('reward'); return { granted: true, amountBonus: 7, balanceAfterBonus: 12, transactionId: 'tx-1' }; } },
    storage: { get: async () => Buffer.from('photo'), delete: async () => sequence.push('delete') },
    customerWorkflow: { recordModerationDecision: async () => ({}), recordPublished: async () => {}, recordRewarded: async () => sequence.push('notifyReward') },
    moderationLifecycle: { recordModerationResult: async () => {}, recordSourceDeletion: async () => sequence.push('sourceDeletion') },
  });
  const result = await service.decide(admin, 'photo-1', { action: 'approve' });
  assert.equal(result.stage, 'completed');
  assert.ok(sequence.indexOf('publish') < sequence.indexOf('reward'));
  assert.ok(sequence.indexOf('reward') < sequence.indexOf('delete'));
  assert.ok(sequence.indexOf('delete') < sequence.indexOf('sourceDeletion'));
});
