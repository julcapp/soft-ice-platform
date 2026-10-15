const { assertAdmin } = require('./PhotoVerificationAdminService');

const APPLICATION_TARGET_TYPE = 'PHOTO_AI_RECOMMENDATION_APPLICATION';
const ROLLBACK_TARGET_TYPE = 'PHOTO_AI_RECOMMENDATION_ROLLBACK';

class PhotoAiRecommendationApplicationHistoryService {
  constructor({ prisma, adminService }) {
    if (!prisma) throw new Error('prisma is required');
    if (!adminService) throw new Error('adminService is required');
    this.prisma = prisma;
    this.adminService = adminService;
  }

  async list(securityContext, { limit = 100 } = {}) {
    assertAdmin(securityContext);
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);
    const rows = await this.prisma.$queryRaw`
      SELECT
        a."id",
        a."targetId" AS "recommendationKey",
        a."subjectId" AS "actorId",
        a."correlationId",
        a."metadata",
        a."occurredAt"
      FROM "AuditEvent" a
      WHERE a."targetType" = ${APPLICATION_TARGET_TYPE}
        AND a."action" = 'applied'
      ORDER BY a."occurredAt" DESC
      LIMIT ${safeLimit}
    `;

    const currentSettings = await this.adminService.getSettings(securityContext, 'default') || {};
    const items = [];
    for (const row of rows) {
      const metadata = row.metadata || {};
      const preparationId = metadata.preparationId;
      if (!preparationId) continue;
      const fields = Object.keys(metadata.after || {});
      const currentSelected = selectFields(currentSettings, fields);
      const expectedAfter = selectFields(metadata.after || {}, fields);
      const rollbackRows = await this.prisma.$queryRaw`
        SELECT "action", "metadata", "occurredAt", "subjectId" AS "actorId"
        FROM "AuditEvent"
        WHERE "targetType" = ${ROLLBACK_TARGET_TYPE}
          AND "targetId" = ${preparationId}
          AND "action" IN ('rollback_prepared', 'rolled_back')
        ORDER BY "occurredAt" ASC
      `;
      const rolledBack = rollbackRows.filter((event) => event.action === 'rolled_back').at(-1) || null;
      const preparedRollback = rollbackRows.filter((event) => event.action === 'rollback_prepared').at(-1) || null;
      const currentMatchesApplied = stable(currentSelected) === stable(expectedAfter);
      items.push({
        applicationEventId: row.id,
        preparationId,
        recommendationKey: row.recommendationKey,
        actorId: row.actorId,
        correlationId: row.correlationId,
        appliedAt: row.occurredAt,
        before: metadata.before || {},
        patch: metadata.patch || {},
        after: metadata.after || {},
        rolledBack: Boolean(rolledBack),
        rolledBackAt: rolledBack?.occurredAt || null,
        rolledBackBy: rolledBack?.actorId || null,
        lastRollbackPreparationId: preparedRollback?.metadata?.rollbackId || null,
        rollbackAvailable: !rolledBack && currentMatchesApplied,
        rollbackBlockedReason: rolledBack ? 'already_rolled_back' : currentMatchesApplied ? null : 'settings_changed_after_application',
        current: currentSelected,
      });
    }
    return items;
  }
}

function selectFields(source, keys) {
  return Object.fromEntries(keys.map((key) => [key, normalize(source?.[key])]));
}
function normalize(value) {
  if (value && typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber();
  return value;
}
function stable(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

module.exports = { PhotoAiRecommendationApplicationHistoryService, APPLICATION_TARGET_TYPE, ROLLBACK_TARGET_TYPE };
