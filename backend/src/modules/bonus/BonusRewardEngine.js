const { randomUUID } = require('node:crypto');

class BonusRewardEngine {
  constructor({ prisma, resolveBonusUnits = null, clock = () => new Date() } = {}) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
    this.resolveBonusUnits = resolveBonusUnits;
    this.clock = clock;
  }

  async grant({ photoChallengeId, customerId, correlationId = null, idempotencyKey }) {
    if (!photoChallengeId) throw new Error('photoChallengeId is required');
    if (!customerId) throw new Error('customerId is required');
    if (!idempotencyKey) throw new Error('idempotencyKey is required');

    const amountBonus = Number(await this.resolveBonusUnits?.({ photoChallengeId, customerId }));
    if (!Number.isInteger(amountBonus) || amountBonus <= 0) {
      return { granted: false, reasonCode: 'PHOTO_REWARD_BONUS_UNITS_NOT_CONFIGURED' };
    }

    return this.prisma.$transaction(async (tx) => {
      const idempotencyId = randomUUID();
      const inserted = await tx.$queryRaw`
        INSERT INTO "IdempotencyRecord" (
          "id", "scope", "key", "actorContext", "semanticHash", "status", "correlationId", "firstSeenAt", "lastSeenAt"
        ) VALUES (
          ${idempotencyId}, 'PHOTO_REWARD', ${idempotencyKey},
          ${JSON.stringify({ customerId, photoChallengeId })}::jsonb,
          ${`photo:${photoChallengeId}:customer:${customerId}:amount:${amountBonus}`},
          'STARTED', ${correlationId}, ${this.clock()}, ${this.clock()}
        )
        ON CONFLICT ("scope", "key") DO NOTHING
        RETURNING "id"
      `;

      if (inserted.length === 0) {
        const existingRows = await tx.$queryRaw`
          SELECT "status", "resultReference"
          FROM "IdempotencyRecord"
          WHERE "scope" = 'PHOTO_REWARD' AND "key" = ${idempotencyKey}
          LIMIT 1
        `;
        const existing = existingRows[0];
        if (existing?.status === 'COMPLETED' && existing.resultReference) {
          const rows = await tx.$queryRaw`
            SELECT "id", "amountBonus", "balanceAfterBonus"
            FROM "BonusTransaction"
            WHERE "id" = ${existing.resultReference}
            LIMIT 1
          `;
          const transaction = rows[0] || null;
          return {
            granted: true,
            idempotentReplay: true,
            transactionId: existing.resultReference,
            amountBonus: transaction?.amountBonus ?? amountBonus,
            balanceAfterBonus: transaction?.balanceAfterBonus ?? null,
          };
        }
        return { granted: false, reasonCode: 'PHOTO_REWARD_ALREADY_PROCESSING' };
      }

      await tx.$executeRaw`
        INSERT INTO "BonusAccount" ("id", "customerId", "balanceBonus", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${customerId}, 0, ${this.clock()}, ${this.clock()})
        ON CONFLICT ("customerId") DO NOTHING
      `;

      const accountRows = await tx.$queryRaw`
        UPDATE "BonusAccount"
        SET "balanceBonus" = "balanceBonus" + ${amountBonus}, "updatedAt" = ${this.clock()}
        WHERE "customerId" = ${customerId}
        RETURNING "balanceBonus"
      `;
      const balanceAfterBonus = Number(accountRows[0]?.balanceBonus);
      if (!Number.isInteger(balanceAfterBonus)) throw new Error('Bonus account update failed');

      const transactionId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO "BonusTransaction" (
          "id", "customerId", "orderId", "referralId", "type", "direction", "amountBonus",
          "source", "reason", "referenceEntityType", "referenceEntityId", "balanceAfterBonus",
          "comment", "createdAt", "postedAt"
        ) VALUES (
          ${transactionId}, ${customerId}, NULL, NULL, 'PHOTO_REWARD', 'credit', ${amountBonus},
          'PHOTO_VERIFICATION', 'Награда за подтверждённую публикацию фотографии',
          'PhotoChallenge', ${photoChallengeId}, ${balanceAfterBonus}, NULL, ${this.clock()}, ${this.clock()}
        )
      `;

      await tx.$executeRaw`
        UPDATE "IdempotencyRecord"
        SET "status" = 'COMPLETED', "resultReference" = ${transactionId}, "lastSeenAt" = ${this.clock()}
        WHERE "scope" = 'PHOTO_REWARD' AND "key" = ${idempotencyKey}
      `;

      return {
        granted: true,
        idempotentReplay: false,
        transactionId,
        amountBonus,
        balanceAfterBonus,
      };
    });
  }
}

module.exports = { BonusRewardEngine };
