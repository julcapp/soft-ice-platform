const { assertAdmin } = require('./PhotoVerificationAdminService');

class PhotoVerificationMetricsService {
  constructor({ repository, manualReviewService }) {
    if (!repository) throw new Error('repository is required');
    if (!manualReviewService) throw new Error('manualReviewService is required');
    this.repository = repository;
    this.manualReviewService = manualReviewService;
  }

  async getSnapshot(securityContext) {
    assertAdmin(securityContext);
    const [decisions, channels, manualQueue, operationalIssues] = await Promise.all([
      this.repository.getDecisionMetrics(),
      this.repository.getChannelMetrics(),
      this.repository.listManualReviewQueue({ limit: 100 }),
      this.manualReviewService.listOperationalIssues(securityContext, { limit: 200 }),
    ]);

    const issueCounts = operationalIssues.reduce((acc, item) => {
      acc[item.issueType] = (acc[item.issueType] || 0) + 1;
      return acc;
    }, {});
    const totalDecided = Number(decisions.approved || 0) + Number(decisions.rejected || 0) + Number(decisions.manualReview || 0);
    const percent = (value) => totalDecided ? Math.round((Number(value || 0) / totalDecided) * 1000) / 10 : 0;

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        submitted: Number(decisions.submitted || 0),
        manualReview: manualQueue.length,
        publicationPending: issueCounts.publication_pending || 0,
        publicationIncomplete: issueCounts.publication_incomplete || 0,
        rewardPending: issueCounts.reward_pending || 0,
        sourceDeletionPending: issueCounts.source_deletion_pending || 0,
      },
      decisions: {
        approved: Number(decisions.approved || 0),
        rejected: Number(decisions.rejected || 0),
        manualReview: Number(decisions.manualReview || 0),
        manualDecisions: Number(decisions.manualDecisions || 0),
        autoApproved: Number(decisions.autoApproved || 0),
        autoRejected: Number(decisions.autoRejected || 0),
        autoApprovePercent: percent(decisions.autoApproved),
        autoRejectPercent: percent(decisions.autoRejected),
        manualPercent: percent(decisions.manualReview),
        averageModerationSeconds: decisions.averageModerationSeconds == null ? null : Math.round(Number(decisions.averageModerationSeconds)),
      },
      channels: channels.map((row) => ({
        channel: row.channel,
        total: Number(row.total || 0),
        published: Number(row.published || 0),
        failed: Number(row.failed || 0),
        pending: Number(row.pending || 0),
        notConfigured: Number(row.notConfigured || 0),
      })),
    };
  }
}

module.exports = { PhotoVerificationMetricsService };
