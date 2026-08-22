const test = require('node:test');
const assert = require('node:assert/strict');
const { PhotoVerificationMetricsService } = require('../src/modules/photo_verification/PhotoVerificationMetricsService');

const admin = { roles: ['ADMIN'], userId: 'admin-1' };

test('metrics snapshot combines moderation, recovery and channel counters', async () => {
  let query = 0;
  const prisma = {
    async $queryRaw() {
      query += 1;
      if (query === 1) return [{
        submitted: 20n, approved: 10n, rejected: 4n, manualReview: 6n,
        manualDecisions: 3n, autoApproved: 7n, autoRejected: 2n,
        averageModerationSeconds: 125.4,
      }];
      return [
        { channel: 'VK', total: 10n, published: 9n, failed: 1n, pending: 0n, notConfigured: 0n },
        { channel: 'MAX', total: 10n, published: 8n, failed: 0n, pending: 1n, notConfigured: 1n },
      ];
    },
  };
  const manualReviewService = {
    list: async () => [{}, {}],
    listOperationalIssues: async () => [
      { issueType: 'publication_incomplete' },
      { issueType: 'reward_pending' },
      { issueType: 'reward_pending' },
    ],
  };
  const service = new PhotoVerificationMetricsService({ prisma, manualReviewService });
  const result = await service.getSnapshot(admin);

  assert.equal(result.totals.submitted, 20);
  assert.equal(result.totals.manualReview, 2);
  assert.equal(result.totals.publicationIncomplete, 1);
  assert.equal(result.totals.rewardPending, 2);
  assert.equal(result.decisions.averageModerationSeconds, 125);
  assert.equal(result.decisions.autoApprovePercent, 35);
  assert.equal(result.channels[0].published, 9);
});

test('metrics require admin role', async () => {
  const service = new PhotoVerificationMetricsService({
    prisma: { $queryRaw: async () => [] },
    manualReviewService: { list: async () => [], listOperationalIssues: async () => [] },
  });
  await assert.rejects(() => service.getSnapshot({ roles: ['USER'] }), (error) => error.code === 'PHOTO_VERIFICATION_ADMIN_PERMISSION_DENIED');
});
