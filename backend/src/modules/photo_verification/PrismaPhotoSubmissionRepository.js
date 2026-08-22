class PrismaPhotoSubmissionRepository {
  constructor(prisma) {
    if (!prisma) throw new Error('Prisma client is required');
    this.prisma = prisma;
  }

  async findActiveChallengeForCustomer(customerId) {
    const rows = await this.prisma.$queryRaw`
      SELECT "id", "deadlineAt", "status", "createdAt"
      FROM "PhotoChallenge"
      WHERE "customerId" = ${customerId}
        AND "photoFilePath" IS NULL
        AND "deadlineAt" > CURRENT_TIMESTAMP
        AND "status" IN ('waiting', 'resubmit')
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    return rows[0] || null;
  }

  async getChallengeForCustomer(photoChallengeId, customerId) {
    const rows = await this.prisma.$queryRaw`
      SELECT "id", "customerId", "deadlineAt", "status", "photoFilePath"
      FROM "PhotoChallenge"
      WHERE "id" = ${photoChallengeId} AND "customerId" = ${customerId}
      LIMIT 1
    `;
    return rows[0] || null;
  }

  async attachSourceFile({ photoChallengeId, customerId, storageKey }) {
    const changed = await this.prisma.$executeRaw`
      UPDATE "PhotoChallenge"
      SET "photoFilePath" = ${storageKey}, "platform" = 'MINI_APP', "status" = 'moderation'
      WHERE "id" = ${photoChallengeId} AND "customerId" = ${customerId}
    `;
    if (!changed) throw new Error('Photo challenge source file was not attached');
    return storageKey;
  }
}

module.exports = { PrismaPhotoSubmissionRepository };
