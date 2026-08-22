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
        "storageKey" = EXCLUDED."storageKey",
        "status" = EXCLUDED."status",
        "deleteReason" = EXCLUDED."deleteReason",
        "requestedAt" = EXCLUDED."requestedAt",
        "deletedAt" = EXCLUDED."deletedAt",
        "errorMessage" = EXCLUDED."errorMessage",
        "updatedAt" = CURRENT_TIMESTAMP
    `;
    return rowId;
  }
}

module.exports = { PrismaPhotoVerificationRepository };
