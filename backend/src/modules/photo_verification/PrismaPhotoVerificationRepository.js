const crypto = require('node:crypto');

function id() {
  return crypto.randomUUID();
}

class PrismaPhotoVerificationRepository {
  constructor(prisma) {
    if (!prisma) throw new Error('Prisma client is required');
    this.prisma = prisma;
  }

  async recordVerification(input) {
    const rowId = input.id || id();
    await this.prisma.$executeRaw`
      INSERT INTO "PhotoVerificationResult" (
        "id", "photoChallengeId", "provider", "model", "decision",
        "confidence", "fraudScore", "reasonCode", "checks", "aiResponse",
        "metadataResult", "antifraudResult", "promptVersion", "rulesVersion", "agentVersion"
      ) VALUES (
        ${rowId}, ${input.photoChallengeId}, ${input.provider || null}, ${input.model || null}, ${input.decision},
        ${input.confidence ?? null}, ${input.fraudScore ?? null}, ${input.reasonCode || null},
        ${JSON.stringify(input.checks || {})}::jsonb, ${input.aiResponse ? JSON.stringify(input.aiResponse) : null}::jsonb,
        ${input.metadataResult ? JSON.stringify(input.metadataResult) : null}::jsonb,
        ${input.antifraudResult ? JSON.stringify(input.antifraudResult) : null}::jsonb,
        ${input.promptVersion || null}, ${input.rulesVersion || null}, ${input.agentVersion || '0.1'}
      )
    `;
    return rowId;
  }

  async recordEvent(input) {
    const rowId = input.id || id();
    await this.prisma.$executeRaw`
      INSERT INTO "PhotoVerificationEvent" (
        "id", "photoChallengeId", "eventType", "eventSource", "payload", "actorId", "correlationId"
      ) VALUES (
        ${rowId}, ${input.photoChallengeId}, ${input.eventType}, ${input.eventSource},
        ${JSON.stringify(input.payload || {})}::jsonb, ${input.actorId || null}, ${input.correlationId || null}
      )
    `;
    return rowId;
  }

  async issueCaptureChallenge({ photoChallengeId, customerId, tokenHash, issuedAt, expiresAt, correlationId }) {
    const eventId = id();
    await this.recordEvent({
      id: eventId,
      photoChallengeId,
      eventType: 'capture_challenge_issued',
      eventSource: 'photo_capture_challenge_service',
      correlationId,
      payload: {
        customerId,
        tokenHash,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    });
    return eventId;
  }

  async findActiveCaptureChallenge({ photoChallengeId, customerId, now = new Date() }) {
    const rows = await this.prisma.$queryRaw`
      SELECT
        issued."id",
        issued."payload"->>'tokenHash' AS "tokenHash",
        (issued."payload"->>'expiresAt')::timestamptz AS "expiresAt"
      FROM "PhotoVerificationEvent" issued
      WHERE issued."photoChallengeId" = ${photoChallengeId}
        AND issued."eventType" = 'capture_challenge_issued'
        AND issued."payload"->>'customerId' = ${customerId}
        AND (issued."payload"->>'expiresAt')::timestamptz > ${now}
        AND NOT EXISTS (
          SELECT 1 FROM "PhotoVerificationEvent" consumed
          WHERE consumed."photoChallengeId" = issued."photoChallengeId"
            AND consumed."eventType" = 'capture_challenge_consumed'
            AND consumed."payload"->>'issuedEventId' = issued."id"
        )
      ORDER BY issued."createdAt" DESC
      LIMIT 1
    `;
    return rows[0] || null;
  }

  async consumeCaptureChallenge({ photoChallengeId, customerId, issuedEventId, correlationId }) {
    return this.recordEvent({
      photoChallengeId,
      eventType: 'capture_challenge_consumed',
      eventSource: 'photo_capture_challenge_service',
      correlationId,
      payload: { customerId, issuedEventId, consumedAt: new Date().toISOString() },
    });
  }

  async upsertFingerprint(input) {
    const rowId = input.id || id();
    await this.prisma.$executeRaw`
      INSERT INTO "PhotoFingerprint" ("id", "photoChallengeId", "sha256", "pHash", "dHash")
      VALUES (${rowId}, ${input.photoChallengeId}, ${input.sha256}, ${input.pHash || null}, ${input.dHash || null})
      ON CONFLICT ("photoChallengeId") DO UPDATE SET
        "sha256" = EXCLUDED."sha256",
        "pHash" = EXCLUDED."pHash",
        "dHash" = EXCLUDED."dHash"
    `;
    return rowId;
  }

  async findFingerprintCandidates({ photoChallengeId, sha256, limit = 250 }) {
    return this.prisma.$queryRaw`
      SELECT "photoChallengeId", "sha256", "pHash", "dHash"
      FROM "PhotoFingerprint"
      WHERE "photoChallengeId" <> ${photoChallengeId}
      ORDER BY CASE WHEN "sha256" = ${sha256} THEN 0 ELSE 1 END, "createdAt" DESC
      LIMIT ${limit}
    `;
  }

  async recordPublication(input) {
    return this.upsertPublicationAttempt(input);
  }

  async upsertPublicationAttempt(input) {
    const rowId = input.id || id();
    const idempotencyKey = input.idempotencyKey || `${input.photoChallengeId}:${input.channel}`;
    const lastAttemptAt = input.lastAttemptAt || new Date();

    await this.prisma.$executeRaw`
      INSERT INTO "PhotoPublication" (
        "id", "photoChallengeId", "channel", "targetId", "status", "externalPublicationId",
        "publicationUrl", "publishedAt", "confirmedAt", "errorCode", "errorMessage",
        "attemptCount", "lastAttemptAt", "idempotencyKey"
      ) VALUES (
        ${rowId}, ${input.photoChallengeId}, ${input.channel}, ${input.targetId || null}, ${input.status || 'pending'},
        ${input.externalPublicationId || null}, ${input.publicationUrl || null},
        ${input.publishedAt || null}, ${input.confirmedAt || null},
        ${input.errorCode || null}, ${input.errorMessage || null},
        1, ${lastAttemptAt}, ${idempotencyKey}
      )
      ON CONFLICT ("photoChallengeId", "channel") DO UPDATE SET
        "targetId" = EXCLUDED."targetId",
        "status" = EXCLUDED."status",
        "externalPublicationId" = COALESCE(EXCLUDED."externalPublicationId", "PhotoPublication"."externalPublicationId"),
        "publicationUrl" = COALESCE(EXCLUDED."publicationUrl", "PhotoPublication"."publicationUrl"),
        "publishedAt" = COALESCE(EXCLUDED."publishedAt", "PhotoPublication"."publishedAt"),
        "confirmedAt" = COALESCE(EXCLUDED."confirmedAt", "PhotoPublication"."confirmedAt"),
        "errorCode" = EXCLUDED."errorCode",
        "errorMessage" = EXCLUDED."errorMessage",
        "attemptCount" = "PhotoPublication"."attemptCount" + 1,
        "lastAttemptAt" = EXCLUDED."lastAttemptAt",
        "idempotencyKey" = EXCLUDED."idempotencyKey",
        "updatedAt" = CURRENT_TIMESTAMP
    `;
    return rowId;
  }

  async getSettings(scopeKey = 'default') {
    const rows = await this.prisma.$queryRaw`
      SELECT * FROM "PhotoVerificationSettings" WHERE "scopeKey" = ${scopeKey} LIMIT 1
    `;
    return rows[0] || null;
  }

  async upsertSettings(input) {
    const current = await this.getSettings(input.scopeKey || 'default');
    const next = {
      scopeKey: input.scopeKey || 'default',
      enabled: input.enabled ?? current?.enabled ?? false,
      mode: input.mode ?? current?.mode ?? 'manual_only',
      publishingEnabled: input.publishingEnabled ?? current?.publishingEnabled ?? false,
      requiredChannels: input.requiredChannels ?? current?.requiredChannels ?? ['VK', 'TELEGRAM', 'MAX'],
      approvalThreshold: input.approvalThreshold ?? current?.approvalThreshold ?? 0.9,
      rejectionThreshold: input.rejectionThreshold ?? current?.rejectionThreshold ?? 0.65,
      maxFraudScore: input.maxFraudScore ?? current?.maxFraudScore ?? 0.5,
      duplicateChecksEnabled: input.duplicateChecksEnabled ?? current?.duplicateChecksEnabled ?? true,
      metadataChecksEnabled: input.metadataChecksEnabled ?? current?.metadataChecksEnabled ?? true,
      challengeCodeEnabled: input.challengeCodeEnabled ?? current?.challengeCodeEnabled ?? false,
      retentionPolicy: input.retentionPolicy ?? current?.retentionPolicy ?? 'delete_after_publication',
      provider: input.provider ?? current?.provider ?? null,
      model: input.model ?? current?.model ?? null,
      updatedBy: input.updatedBy ?? null,
    };
    await this.prisma.$executeRaw`
      INSERT INTO "PhotoVerificationSettings" (
        "scopeKey", "enabled", "mode", "publishingEnabled", "requiredChannels",
        "approvalThreshold", "rejectionThreshold", "maxFraudScore",
        "duplicateChecksEnabled", "metadataChecksEnabled", "challengeCodeEnabled",
        "retentionPolicy", "provider", "model", "updatedBy"
      ) VALUES (
        ${next.scopeKey}, ${next.enabled}, ${next.mode}, ${next.publishingEnabled}, ${JSON.stringify(next.requiredChannels)}::jsonb,
        ${next.approvalThreshold}, ${next.rejectionThreshold}, ${next.maxFraudScore},
        ${next.duplicateChecksEnabled}, ${next.metadataChecksEnabled}, ${next.challengeCodeEnabled},
        ${next.retentionPolicy}, ${next.provider}, ${next.model}, ${next.updatedBy}
      )
      ON CONFLICT ("scopeKey") DO UPDATE SET
        "enabled" = EXCLUDED."enabled", "mode" = EXCLUDED."mode",
        "publishingEnabled" = EXCLUDED."publishingEnabled", "requiredChannels" = EXCLUDED."requiredChannels",
        "approvalThreshold" = EXCLUDED."approvalThreshold", "rejectionThreshold" = EXCLUDED."rejectionThreshold",
        "maxFraudScore" = EXCLUDED."maxFraudScore", "duplicateChecksEnabled" = EXCLUDED."duplicateChecksEnabled",
        "metadataChecksEnabled" = EXCLUDED."metadataChecksEnabled", "challengeCodeEnabled" = EXCLUDED."challengeCodeEnabled",
        "retentionPolicy" = EXCLUDED."retentionPolicy", "provider" = EXCLUDED."provider",
        "model" = EXCLUDED."model", "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = CURRENT_TIMESTAMP
    `;
    return this.getSettings(next.scopeKey);
  }

  async listCustomerPhotoHistory(customerId) {
    return this.prisma.$queryRaw`
      SELECT
        pc."id" AS "photoChallengeId",
        pc."createdAt" AS "createdAt",
        pc."status" AS "moderationStatus",
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'channel', pp."channel",
              'status', pp."status",
              'publicationUrl', pp."publicationUrl",
              'publishedAt', pp."publishedAt"
            )
          ) FILTER (WHERE pp."id" IS NOT NULL),
          '[]'::jsonb
        ) AS publications,
        MAX(psd."status") AS "sourceFileStatus"
      FROM "PhotoChallenge" pc
      LEFT JOIN "PhotoPublication" pp ON pp."photoChallengeId" = pc."id"
      LEFT JOIN "PhotoSourceDeletion" psd ON psd."photoChallengeId" = pc."id"
      WHERE pc."customerId" = ${customerId}
      GROUP BY pc."id", pc."createdAt", pc."status"
      ORDER BY pc."createdAt" DESC
    `;
  }

  async markSourceDeletion(input) {
    const rowId = input.id || id();
    await this.prisma.$executeRaw`
      INSERT INTO "PhotoSourceDeletion" (
        "id", "photoChallengeId", "storageKey", "status", "deleteReason",
        "requestedAt", "deletedAt", "errorMessage"
      ) VALUES (
        ${rowId}, ${input.photoChallengeId}, ${input.storageKey}, ${input.status || 'pending'},
        ${input.deleteReason || 'publication_confirmed'}, ${input.requestedAt || null},
        ${input.deletedAt || null}, ${input.errorMessage || null}
      )
      ON CONFLICT ("photoChallengeId") DO UPDATE SET
        "storageKey" = EXCLUDED."storageKey", "status" = EXCLUDED."status",
        "deleteReason" = EXCLUDED."deleteReason", "requestedAt" = EXCLUDED."requestedAt",
        "deletedAt" = EXCLUDED."deletedAt", "errorMessage" = EXCLUDED."errorMessage",
        "updatedAt" = CURRENT_TIMESTAMP
    `;
    return rowId;
  }
}

module.exports = { PrismaPhotoVerificationRepository };
