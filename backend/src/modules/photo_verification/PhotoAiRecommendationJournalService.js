const crypto = require('node:crypto');
const { assertAdmin } = require('./PhotoVerificationAdminService');

const DECISIONS = Object.freeze({ ACCEPT: 'accept', REJECT: 'reject', DEFER: 'defer' });
const TARGET_TYPE = 'PHOTO_AI_RECOMMENDATION';
const SUBJECT_TYPE = 'PHOTO_VERIFICATION_ADMIN';

class PhotoAiRecommendationJournalService {
  constructor({ prisma, metricsService, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    if (!metricsService) throw new Error('metricsService is required');
    this.prisma = prisma;
    this.metricsService = metricsService;
    this.clock = clock;
  }

  async evaluate(securityContext, { period = '7d', correlationId = null } = {}) {
    assertAdmin(securityContext);
    const snapshot = await this.metricsService.getSnapshot(securityContext, { period });
    const periodKey = snapshot.period?.key || period;
    const recommendations = (snapshot.recommendations || []).map((item) => ({
      ...item,
      recommendationKey: `${periodKey}:${item.id}`,
    }));
    const activeKeys = new Set(recommendations.map((item) => item.recommendationKey));
    const previous = await this.#latestLifecycleByPeriod(periodKey);
    const actorId = actor(securityContext);

    for (const item of recommendations) {
      if (previous.get(item.recommendationKey)?.action !== 'appeared') {
        await this.#record({
          action: 'appeared', decision: 'active', recommendationKey: item.recommendationKey,
          actorId, correlationId,
          metadata: { period: periodKey, recommendationId: item.id, severity: item.severity, title: item.title, evidence: item.evidence || {} },
        });
      }
    }
    for (const [recommendationKey, lifecycle] of previous) {
      if (lifecycle.action === 'appeared' && !activeKeys.has(recommendationKey)) {
        await this.#record({
          action: 'disappeared', decision: 'inactive', recommendationKey,
          actorId, correlationId,
          metadata: { period: periodKey, recommendationId: recommendationKey.slice(periodKey.length + 1) },
        });
      }
    }

    const state = await this.#stateForKeys(recommendations.map((item) => item.recommendationKey));
    return {
      period: snapshot.period,
      generatedAt: snapshot.generatedAt,
      recommendations: recommendations.map((item) => ({ ...item, journal: state.get(item.recommendationKey) || emptyState() })),
    };
  }

  async markViewed(securityContext, recommendationKey, { correlationId = null } = {}) {
    assertAdmin(securityContext);
    validateKey(recommendationKey);
    await this.#record({
      action: 'viewed', decision: 'acknowledged', recommendationKey,
      actorId: actor(securityContext), correlationId, metadata: {},
    });
    return this.getState(securityContext, recommendationKey);
  }

  async decide(securityContext, recommendationKey, { decision, comment = '', deferUntil = null, correlationId = null } = {}) {
    assertAdmin(securityContext);
    validateKey(recommendationKey);
    if (!Object.values(DECISIONS).includes(decision)) throw invalid('PHOTO_AI_RECOMMENDATION_DECISION_INVALID');
    const normalizedComment = String(comment || '').trim();
    let normalizedDeferUntil = null;
    if (decision === DECISIONS.DEFER && deferUntil) {
      const date = new Date(deferUntil);
      if (Number.isNaN(date.getTime()) || date <= this.clock()) throw invalid('PHOTO_AI_RECOMMENDATION_DEFER_UNTIL_INVALID');
      normalizedDeferUntil = date.toISOString();
    }
    await this.#record({
      action: 'decision', decision, recommendationKey,
      actorId: actor(securityContext), correlationId,
      metadata: { comment: normalizedComment || null, deferUntil: normalizedDeferUntil, advisoryOnly: true, settingsApplied: false },
    });
    return this.getState(securityContext, recommendationKey);
  }

  async getState(securityContext, recommendationKey) {
    assertAdmin(securityContext);
    validateKey(recommendationKey);
    const states = await this.#stateForKeys([recommendationKey]);
    return states.get(recommendationKey) || emptyState();
  }

  async history(securityContext, { period = '7d', limit = 100 } = {}) {
    assertAdmin(securityContext);
    const prefix = `${period}:%`;
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);
    const rows = await this.prisma.$queryRaw`
      SELECT "id", "targetId" AS "recommendationKey", "action", "decision", "reasonCode",
             "subjectId" AS "actorId", "correlationId", "metadata", "occurredAt"
      FROM "AuditEvent"
      WHERE "targetType" = ${TARGET_TYPE} AND "targetId" LIKE ${prefix}
      ORDER BY "occurredAt" DESC
      LIMIT ${safeLimit}
    `;
    return rows;
  }

  async #latestLifecycleByPeriod(periodKey) {
    const prefix = `${periodKey}:%`;
    const rows = await this.prisma.$queryRaw`
      SELECT DISTINCT ON ("targetId") "targetId" AS "recommendationKey", "action", "occurredAt"
      FROM "AuditEvent"
      WHERE "targetType" = ${TARGET_TYPE}
        AND "targetId" LIKE ${prefix}
        AND "action" IN ('appeared', 'disappeared')
      ORDER BY "targetId", "occurredAt" DESC
    `;
    return new Map(rows.map((row) => [row.recommendationKey, row]));
  }

  async #stateForKeys(keys) {
    if (!keys.length) return new Map();
    const rows = await this.prisma.$queryRaw`
      SELECT "targetId" AS "recommendationKey", "action", "decision", "subjectId" AS "actorId", "metadata", "occurredAt"
      FROM "AuditEvent"
      WHERE "targetType" = ${TARGET_TYPE} AND "targetId" = ANY(${keys}::text[])
      ORDER BY "occurredAt" ASC
    `;
    const states = new Map();
    for (const row of rows) {
      const state = states.get(row.recommendationKey) || emptyState();
      if (row.action === 'appeared') { state.firstSeenAt ||= row.occurredAt; state.lastSeenAt = row.occurredAt; state.active = true; }
      if (row.action === 'disappeared') { state.disappearedAt = row.occurredAt; state.active = false; }
      if (row.action === 'viewed') { state.viewedAt = row.occurredAt; state.viewedBy = row.actorId; }
      if (row.action === 'decision') {
        state.decision = row.decision; state.decidedAt = row.occurredAt; state.decidedBy = row.actorId;
        state.comment = row.metadata?.comment || null; state.deferUntil = row.metadata?.deferUntil || null;
      }
      states.set(row.recommendationKey, state);
    }
    return states;
  }

  async #record({ action, decision, recommendationKey, actorId, correlationId, metadata }) {
    const now = this.clock();
    await this.prisma.$executeRaw`
      INSERT INTO "AuditEvent" (
        "id", "eventType", "subjectType", "subjectId", "targetType", "targetId",
        "action", "decision", "sourceChannel", "correlationId", "metadata", "occurredAt"
      ) VALUES (
        ${crypto.randomUUID()}, 'photo_ai_recommendation_journal', ${SUBJECT_TYPE}, ${actorId}, ${TARGET_TYPE}, ${recommendationKey},
        ${action}, ${decision}, 'ADMIN_CONSOLE', ${correlationId}, ${JSON.stringify(metadata || {})}::jsonb, ${now}
      )
    `;
  }
}

function actor(securityContext) { return securityContext?.userId || securityContext?.actorId || securityContext?.subject || 'admin'; }
function emptyState() { return { active: false, firstSeenAt: null, lastSeenAt: null, disappearedAt: null, viewedAt: null, viewedBy: null, decision: null, decidedAt: null, decidedBy: null, comment: null, deferUntil: null }; }
function validateKey(value) { if (!/^(today|7d|30d):[a-z0-9_:-]+$/i.test(String(value || ''))) throw invalid('PHOTO_AI_RECOMMENDATION_KEY_INVALID'); }
function invalid(code) { const error = new Error(code); error.code = code; error.statusCode = 400; return error; }

module.exports = { PhotoAiRecommendationJournalService, DECISIONS, TARGET_TYPE };
