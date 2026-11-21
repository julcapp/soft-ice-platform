const crypto = require('node:crypto');
const { assertAdmin } = require('./PhotoVerificationAdminService');

const TARGET_TYPE = 'PHOTO_AI_RECOMMENDATION_APPLICATION';
const IDEMPOTENCY_SCOPE = 'PHOTO_AI_RECOMMENDATION_APPLICATION';
const ALLOWED_PATCH_FIELDS = new Set(['mode', 'approvalThreshold']);

class PhotoAiRecommendationApplicationService {
  constructor({ prisma, metricsService, journalService, adminService, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    if (!metricsService) throw new Error('metricsService is required');
    if (!journalService) throw new Error('journalService is required');
    if (!adminService) throw new Error('adminService is required');
    this.prisma = prisma;
    this.metricsService = metricsService;
    this.journalService = journalService;
    this.adminService = adminService;
    this.clock = clock;
  }

  async prepare(securityContext, recommendationKey, { correlationId = null } = {}) {
    assertAdmin(securityContext);
    const { period, recommendationId } = parseRecommendationKey(recommendationKey);
    const journal = await this.journalService.getState(securityContext, recommendationKey);
    if (journal.decision !== 'accept') throw conflict('PHOTO_AI_RECOMMENDATION_NOT_ACCEPTED');

    const snapshot = await this.metricsService.getSnapshot(securityContext, { period });
    const recommendation = (snapshot.recommendations || []).find((item) => item.id === recommendationId);
    if (!recommendation) throw conflict('PHOTO_AI_RECOMMENDATION_NOT_ACTIVE');

    const current = await this.adminService.getSettings(securityContext, 'default') || {};
    const patch = buildPatch(recommendation, current);
    if (!Object.keys(patch).length) throw conflict('PHOTO_AI_RECOMMENDATION_NO_SAFE_PATCH');
    assertAllowedPatch(patch);

    const before = selectFields(current, Object.keys(patch));
    const after = { ...before, ...patch };
    const preparationId = crypto.randomUUID();
    const semanticHash = hash({ recommendationKey, before, patch, after });
    const now = this.clock();
    const actorId = actor(securityContext);

    await this.prisma.$executeRaw`
      INSERT INTO "AuditEvent" (
        "id", "eventType", "subjectType", "subjectId", "targetType", "targetId",
        "action", "decision", "sourceChannel", "correlationId", "metadata", "occurredAt"
      ) VALUES (
        ${preparationId}, 'photo_ai_recommendation_application', 'PHOTO_VERIFICATION_ADMIN', ${actorId},
        ${TARGET_TYPE}, ${recommendationKey}, 'prepared', 'pending_confirmation', 'ADMIN_CONSOLE', ${correlationId},
        ${JSON.stringify({ preparationId, recommendationId, period, before, patch, after, semanticHash, advisoryAccepted: true, settingsApplied: false })}::jsonb,
        ${now}
      )
    `;

    return { preparationId, recommendationKey, before, patch, after, semanticHash, preparedAt: now.toISOString(), requiresConfirmation: true };
  }

  async apply(securityContext, preparationId, { correlationId = null } = {}) {
    assertAdmin(securityContext);
    if (!/^[0-9a-f-]{36}$/i.test(String(preparationId || ''))) throw invalid('PHOTO_AI_RECOMMENDATION_PREPARATION_ID_INVALID');
    const rows = await this.prisma.$queryRaw`
      SELECT "id", "targetId" AS "recommendationKey", "metadata", "occurredAt"
      FROM "AuditEvent"
      WHERE "id" = ${preparationId} AND "targetType" = ${TARGET_TYPE} AND "action" = 'prepared'
      LIMIT 1
    `;
    const prepared = rows[0];
    if (!prepared) throw invalid('PHOTO_AI_RECOMMENDATION_PREPARATION_NOT_FOUND', 404);
    const metadata = prepared.metadata || {};
    const patch = metadata.patch || {};
    const before = metadata.before || {};
    assertAllowedPatch(patch);

    const existingApplied = await this.prisma.$queryRaw`
      SELECT "id" FROM "AuditEvent"
      WHERE "targetType" = ${TARGET_TYPE} AND "targetId" = ${prepared.recommendationKey}
        AND "action" = 'applied' AND "metadata"->>'preparationId' = ${preparationId}
      LIMIT 1
    `;
    if (existingApplied.length) {
      return { applied: true, idempotentReplay: true, preparationId, recommendationKey: prepared.recommendationKey };
    }

    const current = await this.adminService.getSettings(securityContext, 'default') || {};
    const currentSelected = selectFields(current, Object.keys(patch));
    if (stable(currentSelected) !== stable(before)) {
      throw conflict('PHOTO_AI_RECOMMENDATION_SETTINGS_CHANGED');
    }

    const claimed = await this.#claim(preparationId, securityContext, correlationId, metadata.semanticHash || hash({ before, patch }));
    if (!claimed) {
      const completed = await this.#completed(preparationId);
      if (completed) return { applied: true, idempotentReplay: true, preparationId, recommendationKey: prepared.recommendationKey };
      throw conflict('PHOTO_AI_RECOMMENDATION_APPLICATION_IN_PROGRESS');
    }

    try {
      const saved = await this.adminService.updateSettings(securityContext, patch, 'default');
      const after = selectFields(saved || {}, Object.keys(patch));
      const now = this.clock();
      await this.prisma.$executeRaw`
        INSERT INTO "AuditEvent" (
          "id", "eventType", "subjectType", "subjectId", "targetType", "targetId",
          "action", "decision", "sourceChannel", "correlationId", "metadata", "occurredAt"
        ) VALUES (
          ${crypto.randomUUID()}, 'photo_ai_recommendation_application', 'PHOTO_VERIFICATION_ADMIN', ${actor(securityContext)},
          ${TARGET_TYPE}, ${prepared.recommendationKey}, 'applied', 'confirmed', 'ADMIN_CONSOLE', ${correlationId},
          ${JSON.stringify({ preparationId, before, patch, after, settingsApplied: true })}::jsonb, ${now}
        )
      `;
      await this.#complete(preparationId);
      return { applied: true, idempotentReplay: false, preparationId, recommendationKey: prepared.recommendationKey, before, patch, after, appliedAt: now.toISOString() };
    } catch (error) {
      await this.#release(preparationId);
      throw error;
    }
  }

  async #claim(preparationId, securityContext, correlationId, semanticHash) {
    const now = this.clock();
    const rows = await this.prisma.$queryRaw`
      INSERT INTO "IdempotencyRecord" (
        "id", "scope", "key", "actorContext", "semanticHash", "status", "correlationId", "firstSeenAt", "lastSeenAt"
      ) VALUES (
        ${crypto.randomUUID()}, ${IDEMPOTENCY_SCOPE}, ${preparationId},
        ${JSON.stringify({ actorId: actor(securityContext), preparationId })}::jsonb,
        ${semanticHash}, 'processing', ${correlationId}, ${now}, ${now}
      )
      ON CONFLICT ("scope", "key") DO NOTHING
      RETURNING "id"
    `;
    return rows.length > 0;
  }

  async #completed(preparationId) {
    const rows = await this.prisma.$queryRaw`
      SELECT "status" FROM "IdempotencyRecord"
      WHERE "scope" = ${IDEMPOTENCY_SCOPE} AND "key" = ${preparationId}
      LIMIT 1
    `;
    return rows[0]?.status === 'completed';
  }

  async #complete(preparationId) {
    await this.prisma.$executeRaw`
      UPDATE "IdempotencyRecord" SET "status" = 'completed', "lastSeenAt" = CURRENT_TIMESTAMP
      WHERE "scope" = ${IDEMPOTENCY_SCOPE} AND "key" = ${preparationId}
    `;
  }

  async #release(preparationId) {
    await this.prisma.$executeRaw`
      DELETE FROM "IdempotencyRecord"
      WHERE "scope" = ${IDEMPOTENCY_SCOPE} AND "key" = ${preparationId} AND "status" = 'processing'
    `;
  }
}

function buildPatch(recommendation, current) {
  if (recommendation.id === 'high_disagreement_review_mode') {
    return current.mode === 'manual_only' ? {} : { mode: 'manual_only' };
  }
  if (recommendation.id === 'review_auto_approve_threshold') {
    const suggested = Number(recommendation.evidence?.suggestedApprovalThreshold);
    const currentValue = Number(current.approvalThreshold);
    if (!Number.isFinite(suggested) || suggested <= 0 || suggested > 0.99) return {};
    if (Number.isFinite(currentValue) && suggested <= currentValue) return {};
    return { approvalThreshold: suggested };
  }
  return {};
}

function assertAllowedPatch(patch) {
  for (const key of Object.keys(patch || {})) {
    if (!ALLOWED_PATCH_FIELDS.has(key)) throw invalid('PHOTO_AI_RECOMMENDATION_PATCH_NOT_ALLOWED');
  }
}
function selectFields(source, keys) { return Object.fromEntries(keys.map((key) => [key, normalize(source?.[key])])); }
function normalize(value) { if (value && typeof value === 'object' && typeof value.toNumber === 'function') return value.toNumber(); return value; }
function parseRecommendationKey(value) {
  const match = /^(today|7d|30d):([a-z0-9_:-]+)$/i.exec(String(value || ''));
  if (!match) throw invalid('PHOTO_AI_RECOMMENDATION_KEY_INVALID');
  return { period: match[1], recommendationId: match[2] };
}
function actor(securityContext) { return securityContext?.userId || securityContext?.actorId || securityContext?.subject || 'admin'; }
function stable(value) { return JSON.stringify(value, Object.keys(value || {}).sort()); }
function hash(value) { return crypto.createHash('sha256').update(stable(value)).digest('hex'); }
function invalid(code, statusCode = 400) { const error = new Error(code); error.code = code; error.statusCode = statusCode; return error; }
function conflict(code) { return invalid(code, 409); }

module.exports = { PhotoAiRecommendationApplicationService, buildPatch, ALLOWED_PATCH_FIELDS, TARGET_TYPE };
