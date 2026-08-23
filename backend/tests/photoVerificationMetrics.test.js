const test = require('node:test');
const assert = require('node:assert/strict');
const { PhotoVerificationMetricsService, resolvePeriod, buildAdvisoryRecommendations } = require('../src/modules/photo_verification/PhotoVerificationMetricsService');

const admin = { roles: ['ADMIN'], userId: 'admin-1' };
const fixedNow = new Date('2026-08-22T15:00:00.000Z');

test('metrics snapshot combines period moderation, recovery, quality, recommendations, trends and channel counters', async () => {
  let query = 0;
  const prisma = {
    async $queryRaw() {
      query += 1;
      if (query === 1) return [{ submitted: 20n, approved: 10n, rejected: 4n, manualReview: 6n, manualDecisions: 3n, autoApproved: 7n, autoRejected: 2n, averageModerationSeconds: 125.4 }];
      if (query === 2) return [
        { channel: 'VK', total: 10n, published: 9n, failed: 1n, pending: 0n, notConfigured: 0n },
        { channel: 'MAX', total: 10n, published: 8n, failed: 0n, pending: 1n, notConfigured: 1n },
      ];
      if (query === 3) return [{ day: new Date('2026-08-22T00:00:00Z'), autoApproved: 3n, autoRejected: 1n, manual: 2n }];
      if (query === 4) return [{ reviewedByHuman: 8n, comparable: 6n, agreements: 4n, disagreements: 2n, aiApproveHumanReject: 1n, aiRejectHumanApprove: 1n, aiEscalated: 2n }];
      if (query === 5) return [{ reasonCode: 'capture_code_mismatch', count: 3n }, { reasonCode: 'duplicate_suspected', count: 2n }];
      return [{ mode: 'ai_assisted', approvalThreshold: 0.9, rejectionThreshold: 0.65, maxFraudScore: 0.5, challengeCodeEnabled: true }];
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
  const service = new PhotoVerificationMetricsService({ prisma, manualReviewService, clock: () => fixedNow });
  const result = await service.getSnapshot(admin, { period: '7d' });

  assert.equal(result.period.key, '7d');
  assert.equal(result.period.endAt, fixedNow.toISOString());
  assert.equal(result.totals.submitted, 20);
  assert.equal(result.totals.manualReview, 2);
  assert.equal(result.totals.publicationIncomplete, 1);
  assert.equal(result.totals.rewardPending, 2);
  assert.equal(result.decisions.averageModerationSeconds, 125);
  assert.equal(result.decisions.autoApprovePercent, 35);
  assert.equal(result.channels[0].published, 9);
  assert.equal(result.channels[0].successPercent, 90);
  assert.equal(result.trend[0].autoApproved, 3);
  assert.equal(result.quality.reviewedByHuman, 8);
  assert.equal(result.quality.agreementPercent, 66.7);
  assert.equal(result.quality.disagreementPercent, 33.3);
  assert.equal(result.quality.aiApproveHumanReject, 1);
  assert.equal(result.quality.aiRejectHumanApprove, 1);
  assert.equal(result.quality.escalationReasons[0].reasonCode, 'capture_code_mismatch');
  assert.equal(result.quality.escalationReasons[0].count, 3);
  assert.ok(result.recommendations.some((item) => item.id === 'review_visual_freshness'));
  assert.ok(result.recommendations.every((item) => item.advisoryOnly === true));
});

test('advisory engine recommends manual-only review for high disagreement without applying changes', () => {
  const recommendations = buildAdvisoryRecommendations({
    quality: {
      comparable: 20, disagreementPercent: 25, aiApproveHumanReject: 4, aiRejectHumanApprove: 1,
      escalationReasons: [],
    },
    settings: { mode: 'ai_assisted', approvalThreshold: 0.9, rejectionThreshold: 0.65 },
  });
  const disagreement = recommendations.find((item) => item.id === 'high_disagreement_review_mode');
  const approve = recommendations.find((item) => item.id === 'review_auto_approve_threshold');
  assert.equal(disagreement.severity, 'high');
  assert.match(disagreement.suggestedAction, /manual_only/);
  assert.equal(approve.evidence.suggestedApprovalThreshold, 0.93);
  assert.equal(approve.advisoryOnly, true);
});

test('advisory engine avoids strong tuning recommendation on a small control sample', () => {
  const recommendations = buildAdvisoryRecommendations({
    quality: { comparable: 3, disagreementPercent: 66.7, aiApproveHumanReject: 2, aiRejectHumanApprove: 0, escalationReasons: [] },
    settings: { mode: 'ai_assisted', approvalThreshold: 0.9 },
  });
  assert.ok(recommendations.some((item) => item.id === 'collect_more_human_reviews'));
  assert.equal(recommendations.some((item) => item.id === 'high_disagreement_review_mode'), false);
});

test('period resolver supports today, 7d, 30d and safe fallback', () => {
  assert.equal(resolvePeriod('today', fixedNow).startAt.toISOString(), '2026-08-22T00:00:00.000Z');
  assert.equal(resolvePeriod('7d', fixedNow).startAt.toISOString(), '2026-08-15T15:00:00.000Z');
  assert.equal(resolvePeriod('30d', fixedNow).startAt.toISOString(), '2026-07-23T15:00:00.000Z');
  assert.equal(resolvePeriod('bad', fixedNow).key, '7d');
});

test('metrics require admin role', async () => {
  const service = new PhotoVerificationMetricsService({
    prisma: { $queryRaw: async () => [] },
    manualReviewService: { list: async () => [], listOperationalIssues: async () => [] },
  });
  await assert.rejects(() => service.getSnapshot({ roles: ['USER'] }), (error) => error.code === 'PHOTO_VERIFICATION_ADMIN_PERMISSION_DENIED');
});
