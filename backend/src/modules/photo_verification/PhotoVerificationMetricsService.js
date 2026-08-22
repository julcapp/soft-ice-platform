const { assertAdmin } = require('./PhotoVerificationAdminService');

const PERIODS = Object.freeze({ TODAY: 'today', DAYS_7: '7d', DAYS_30: '30d' });

class PhotoVerificationMetricsService {
  constructor({ prisma, manualReviewService, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    if (!manualReviewService) throw new Error('manualReviewService is required');
    this.prisma = prisma;
    this.manualReviewService = manualReviewService;
    this.clock = clock;
  }

  async getSnapshot(securityContext, { period = PERIODS.DAYS_7 } = {}) {
    assertAdmin(securityContext);
    const range = resolvePeriod(period, this.clock());
    const { startAt, endAt } = range;

    const [decisionRows, channelRows, trendRows, manualQueue, operationalIssues] = await Promise.all([
      this.prisma.$queryRaw`
        WITH latest AS (
          SELECT DISTINCT ON (v."photoChallengeId")
            v."photoChallengeId", v."decision", v."provider", v."processedAt"
          FROM "PhotoVerificationResult" v
          WHERE v."processedAt" >= ${startAt} AND v."processedAt" < ${endAt}
          ORDER BY v."photoChallengeId", v."processedAt" DESC
        )
        SELECT
          COUNT(*) FILTER (WHERE pc."photoFilePath" IS NOT NULL AND pc."createdAt" >= ${startAt} AND pc."createdAt" < ${endAt}) AS "submitted",
          COUNT(*) FILTER (WHERE latest."decision" = 'approved') AS "approved",
          COUNT(*) FILTER (WHERE latest."decision" = 'rejected') AS "rejected",
          COUNT(*) FILTER (WHERE latest."decision" = 'manual_review') AS "manualReview",
          COUNT(*) FILTER (WHERE latest."provider" = 'manual') AS "manualDecisions",
          COUNT(*) FILTER (WHERE latest."provider" <> 'manual' AND latest."decision" = 'approved') AS "autoApproved",
          COUNT(*) FILTER (WHERE latest."provider" <> 'manual' AND latest."decision" = 'rejected') AS "autoRejected",
          AVG(EXTRACT(EPOCH FROM (latest."processedAt" - pc."createdAt"))) FILTER (WHERE latest."processedAt" IS NOT NULL) AS "averageModerationSeconds"
        FROM "PhotoChallenge" pc
        LEFT JOIN latest ON latest."photoChallengeId" = pc."id"
      `,
      this.prisma.$queryRaw`
        SELECT
          pp."channel",
          COUNT(*) AS "total",
          COUNT(*) FILTER (WHERE pp."status" IN ('published', 'confirmed')) AS "published",
          COUNT(*) FILTER (WHERE pp."status" = 'failed') AS "failed",
          COUNT(*) FILTER (WHERE pp."status" = 'pending') AS "pending",
          COUNT(*) FILTER (WHERE pp."status" = 'not_configured') AS "notConfigured"
        FROM "PhotoPublication" pp
        WHERE COALESCE(pp."lastAttemptAt", pp."createdAt") >= ${startAt}
          AND COALESCE(pp."lastAttemptAt", pp."createdAt") < ${endAt}
        GROUP BY pp."channel"
        ORDER BY pp."channel"
      `,
      this.prisma.$queryRaw`
        WITH latest AS (
          SELECT DISTINCT ON (v."photoChallengeId")
            v."photoChallengeId", v."decision", v."provider", v."processedAt"
          FROM "PhotoVerificationResult" v
          WHERE v."processedAt" >= ${startAt} AND v."processedAt" < ${endAt}
          ORDER BY v."photoChallengeId", v."processedAt" DESC
        )
        SELECT
          DATE_TRUNC('day', latest."processedAt") AS "day",
          COUNT(*) FILTER (WHERE latest."provider" <> 'manual' AND latest."decision" = 'approved') AS "autoApproved",
          COUNT(*) FILTER (WHERE latest."provider" <> 'manual' AND latest."decision" = 'rejected') AS "autoRejected",
          COUNT(*) FILTER (WHERE latest."decision" = 'manual_review' OR latest."provider" = 'manual') AS "manual"
        FROM latest
        GROUP BY DATE_TRUNC('day', latest."processedAt")
        ORDER BY "day"
      `,
      this.manualReviewService.list(securityContext, { limit: 100 }),
      this.manualReviewService.listOperationalIssues(securityContext, { limit: 200 }),
    ]);

    const decisions = decisionRows[0] || {};
    const issueCounts = operationalIssues.reduce((acc, item) => {
      acc[item.issueType] = (acc[item.issueType] || 0) + 1;
      return acc;
    }, {});
    const totalDecided = Number(decisions.approved || 0) + Number(decisions.rejected || 0) + Number(decisions.manualReview || 0);
    const percent = (value) => totalDecided ? Math.round((Number(value || 0) / totalDecided) * 1000) / 10 : 0;

    return {
      generatedAt: this.clock().toISOString(),
      period: { key: range.key, startAt: startAt.toISOString(), endAt: endAt.toISOString() },
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
      channels: channelRows.map((row) => {
        const total = Number(row.total || 0);
        const published = Number(row.published || 0);
        return {
          channel: row.channel,
          total,
          published,
          failed: Number(row.failed || 0),
          pending: Number(row.pending || 0),
          notConfigured: Number(row.notConfigured || 0),
          successPercent: total ? Math.round((published / total) * 1000) / 10 : 0,
        };
      }),
      trend: trendRows.map((row) => ({
        day: new Date(row.day).toISOString(),
        autoApproved: Number(row.autoApproved || 0),
        autoRejected: Number(row.autoRejected || 0),
        manual: Number(row.manual || 0),
      })),
    };
  }
}

function resolvePeriod(period, now = new Date()) {
  const key = Object.values(PERIODS).includes(period) ? period : PERIODS.DAYS_7;
  const endAt = new Date(now);
  let startAt;
  if (key === PERIODS.TODAY) {
    startAt = new Date(Date.UTC(endAt.getUTCFullYear(), endAt.getUTCMonth(), endAt.getUTCDate()));
  } else {
    const days = key === PERIODS.DAYS_30 ? 30 : 7;
    startAt = new Date(endAt.getTime() - days * 24 * 60 * 60 * 1000);
  }
  return { key, startAt, endAt };
}

module.exports = { PhotoVerificationMetricsService, PERIODS, resolvePeriod };
