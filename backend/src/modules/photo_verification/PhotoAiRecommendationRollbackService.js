const crypto = require('node:crypto');
const { assertAdmin } = require('./PhotoVerificationAdminService');

const TARGET_TYPE = 'PHOTO_AI_RECOMMENDATION_ROLLBACK';
const APPLICATION_TARGET_TYPE = 'PHOTO_AI_RECOMMENDATION_APPLICATION';
const IDEMPOTENCY_SCOPE = 'PHOTO_AI_RECOMMENDATION_ROLLBACK';
const ALLOWED_ROLLBACK_FIELDS = new Set(['mode', 'approvalThreshold']);

class PhotoAiRecommendationRollbackService {
  constructor({ prisma, adminService, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    if (!adminService) throw new Error('adminService is required');
    this.prisma = prisma;
    this.adminService = adminService;
    this.clock = clock;
  }

  async prepare(securityContext, applicationPreparationId, { correlationId = null } = {}) {
    assertAdmin(securityContext);
    validateUuid(applicationPreparationId, 'PHOTO_AI_RECOMMENDATION_APPLICATION_ID_INVALID');
    const applied = await this.#getApplied(applicationPreparationId);
    if (!applied) throw invalid('PHOTO_AI_RECOMMENDATION_APPLICATION_NOT_FOUND', 404);

    const metadata = applied.metadata || {};
    const originalBefore = metadata.before || {};
    const originalAfter = metadata.after || {};
    const fields = Object.keys(originalBefore);
    assertAllowed(fields);
    if (!fields.length) throw conflict('PHOTO_AI_RECOMMENDATION_ROLLBACK_EMPTY');

    const current = await this.adminService.getSettings(securityContext, 'default') || {};
    const currentSelected = selectFields(current, fields);
    if (stable(currentSelected) !== stable(selectFields(originalAfter, fields))) {
      throw conflict('PHOTO_AI_RECOMMENDATION_ROLLBACK_SETTINGS_CHANGED');
    }

    const rollbackId = crypto.randomUUID();
    const patch = selectFields(originalBefore, fields);
    const before = currentSelected;
    const after = patch;
    const semanticHash = hash({ applicationPreparationId, before, patch, after });
    const now = this.clock();

    await this.prisma.$executeRaw`
      INSERT INTO "AuditEvent" (
        "id", "eventType", "subjectType", "subjectId", "targetType", "targetId",
        "action", "decision", "sourceChannel", "correlationId", "metadata", "occurredAt"
      ) VALUES (
        ${rollbackId}, 'photo_ai_recommendation_rollback', 'PHOTO_VERIFICATION_ADMIN', ${actor(securityContext)},
        ${TARGET_TYPE}, ${applicationPreparationId}, 'rollback_prepared', 'pending_confirmation', 'ADMIN_CONSOLE', ${correlationId},
        ${JSON.stringify({ rollbackId, applicationPreparationId, recommendationKey: applied.recommendationKey, before, patch, after, semanticHash, settingsRolledBack: false })}::jsonb,
        ${now}
      )
    `;

    return { rollbackId, applicationPreparationId, recommendationKey: applied.recommendationKey, before, patch, after, preparedAt: now.toISOString(), requiresConfirmation: true };
  }

  async apply(securityContext, rollbackId, { correlationId = null } = {}) {
    assertAdmin(securityContext);
    validateUuid(rollbackId, 'PHOTO_AI_RECOMMENDATION_ROLLBACK_ID_INVALID');
    const rows = await this.prisma.$queryRaw`
      SELECT "id", "targetId" AS "applicationPreparationId", "metadata", "occurredAt"
      FROM "AuditEvent"
      WHERE "id" = ${rollbackId} AND "targetType" = ${TARGET_TYPE} AND "action" = 'rollback_prepared'
      LIMIT 1
    `;
    const prepared = rows[0];
    if (!prepared) throw invalid('PHOTO_AI_RECOMMENDATION_ROLLBACK_NOT_FOUND', 404);
    const metadata = prepared.metadata || {};
    const patch = metadata.patch || {};
    const before = metadata.before || {};
    const fields = Object.keys(patch);
    assertAllowed(fields);

    const existing = await this.prisma.$queryRaw`
      SELECT "id" FROM "AuditEvent"
      WHERE "targetType" = ${TARGET_TYPE} AND "action" = 'rolled_back'
        AND "metadata"->>'rollbackId' = ${rollbackId}
      LIMIT 1
    `;
    if (existing.length) return { rolledBack: true, idempotentReplay: true, rollbackId, applicationPreparationId: prepared.applicationPreparationId };

    const current = await this.adminService.getSettings(securityContext, 'default') || {};
    const currentSelected = selectFields(current, fields);
    if (stable(currentSelected) !== stable(before)) {
      throw conflict('PHOTO_AI_RECOMMENDATION_ROLLBACK_SETTINGS_CHANGED');
    }

    const claimed = await this.#claim(rollbackId, securityContext, correlationId, metadata.semanticHash || hash({ before, patch }));
    if (!claimed) {
      const completed = await this.#completed(rollbackId);
      if (completed) return { rolledBack: true, idempotentReplay: true, rollbackId, applicationPreparationId: prepared.applicationPreparationId };
      throw conflict('PHOTO_AI_RECOMMENDATION_ROLLBACK_IN_PROGRESS');
    }

    try {
      const saved = await this.adminService.updateSettings(securityContext, patch, 'default');
      const after = selectFields(saved || {}, fields);
      const now = this.clock();
      await this.prisma.$executeRaw`
        INSERT INTO "AuditEvent" (
          "id", "eventType", "subjectType", "subjectId", "targetType", "targetId",
          "action", "decision", "sourceChannel", "correlationId", "metadata", "occurredAt"
        ) VALUES (
          ${crypto.randomUUID()}, 'photo_ai_recommendation_rollback', 'PHOTO_VERIFICATION_ADMIN', ${actor(securityContext)},
          ${TARGET_TYPE}, ${prepared.applicationPreparationId}, 'rolled_back', 'confirmed', 'ADMIN_CONSOLE', ${correlationId},
          ${JSON.stringify({ rollbackId, applicationPreparationId: prepared.applicationPreparationId, before, patch, after, settingsRolledBack: true })}::jsonb,
          ${now}
        )
      `;
      await this.#complete(rollbackId);
      return { rolledBack: true, idempotentReplay: false, rollbackId, applicationPreparationId: prepared.applicationPreparationId, before, patch, after, rolledBackAt: now.toISOString() };
    } catch (error) {
      await this.#release(rollbackId);
      throw error;
    }
  }

  async #getApplied(applicationPreparationId) {
    const rows = await this.prisma.$queryRaw`
      SELECT "targetId" AS "recommendationKey", "metadata", "occurredAt"
      FROM "AuditEvent"
      WHERE "targetType" = ${APPLICATION_TARGET_TYPE} AND "action" = 'applied'
        AND "metadata"->>'preparationId' = ${applicationPreparationId}
      ORDER BY "occurredAt" DESC LIMIT 1
    `;
    return rows[0] || null;
  }

  async #claim(rollbackId, securityContext, correlationId, semanticHash) {
    const now = this.clock();
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "IdempotencyRecord" (
        "id", "scope", "key", "actorContext", "semanticHash", "status", "correlationId", "firstSeenAt", "lastSeenAt"
      ) VALUES (
        ${crypto.randomUUID()}, ${IDEMPOTENCY_SCOPE}, ${rollbackId},
        ${JSON.stringify({ actorId: actor(securityContext), rollbackId })}::jsonb,
        ${semanticHash}, 'processing', ${correlationId}, ${now}, ${now}
      )
      ON CONFLICT ("scope", "key") DO NOTHING
      RETURNING "id"
    `;
    return rows.length > 0;
  }

  async #completed(rollbackId) {
    const rows = await this.prisma.$queryRaw`
      SELECT "status" FROM "IdempotencyRecord"
      WHERE "scope" = ${IDEMPOTENCY_SCOPE} AND "key" = ${rollbackId}
      LIMIT 1
    `;
    return rows[0]?.status === 'completed';
  }

  async #complete(rollbackId) {
    await this.prisma.$executeRaw`
      UPDATE "IdempotencyRecord" SET "status" = 'completed', "lastSeenAt" = CURRENT_TIMESTAMP
      WHERE "scope" = ${IDEMPOTENCY_SCOPE} AND "key" = ${rollbackId}
    `;
  }

  async #release(rollbackId) {
    await this.prisma.$executeRaw`
      DELETE FROM "IdempotencyRecord"
      WHERE "scope" = ${IDEMPOTENCY_SCOPE} AND "key" = ${rollbackId} AND "status" = 'processing'
    `;
  }
}

function assertAllowed(fields) {
  for (const key of fields) if (!ALLOWED_ROLLBACK_FIELDS.has(key)) throw invalid('PHOTO_AI_RECOMMENDATION_ROLLBACK_FIELD_NOT_ALLOWED');
}
function selectFields(source, keys) { return Object.fromEntries(keys.map((key) => [key, normalize(source?.[key])])); }
function normalize(value) { if (value && typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber(); return value; }
function validateUuid(value, code) { if (!/^[0-9a-f-]{36}$/i.test(String(value || ''))) throw invalid(code); }
function actor(securityContext) { return securityContext?.userId || securityContext?.actorId || securityContext?.subject || 'admin'; }
function stable(value) { return JSON.stringify(value, Object.keys(value || {}).sort()); }
function hash(value) { return crypto.createHash('sha256').update(stable(value)).digest('hex'); }
function invalid(code, statusCode = 400) { const error = new Error(code); error.code = code; error.statusCode = statusCode; return error; }
function conflict(code) { return invalid(code, 409); }

module.exports = { PhotoAiRecommendationRollbackService, TARGET_TYPE, ALLOWED_ROLLBACK_FIELDS };
