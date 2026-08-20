class ReferralRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findByReferredCustomerId(referredCustomerId) {
    return this.prisma.referral.findUnique({ where: { referredCustomerId } });
  }

  findByCode(referralCode) {
    return this.prisma.referral.findFirst({ where: { referralCode }, orderBy: { createdAt: 'asc' } });
  }

  create(record) {
    return this.prisma.referral.create({
      data: {
        referrerCustomerId: record.referrerCustomerId,
        referredCustomerId: record.referredCustomerId,
        referralCode: record.referralCode,
        status: record.status || 'registered',
      },
    });
  }

  update(id, patch) {
    const data = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.qualifyingAction === 'first_purchase' && patch.qualifiedAt) data.firstPurchaseAt = new Date(patch.qualifiedAt);
    return this.prisma.referral.update({ where: { id }, data });
  }

  async recordQualification({ referralId, action, sourceEventId = null, occurredAt = new Date() }) {
    const id = cryptoRandomId();
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO "ReferralQualification" ("id", "referralId", "action", "sourceEventId", "occurredAt") VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("referralId") DO NOTHING',
      id, referralId, action, sourceEventId, occurredAt,
    );
    const rows = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM "ReferralQualification" WHERE "referralId" = $1 LIMIT 1',
      referralId,
    );
    return rows[0] || null;
  }

  async getStatsForReferrer(referrerCustomerId) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT
        COUNT(*)::int AS invited,
        COUNT(*) FILTER (WHERE r."referredCustomerId" IS NOT NULL)::int AS registered,
        COUNT(*) FILTER (WHERE q."action" = 'first_purchase')::int AS "firstPurchase",
        COUNT(*) FILTER (WHERE q."action" = 'qualified_club_topup')::int AS "qualifiedTopup",
        COUNT(*) FILTER (WHERE r."status" IN ('registered','qualification_pending'))::int AS "awaitingQualification",
        COUNT(*) FILTER (WHERE r."status" = 'rewarded')::int AS rewarded
       FROM "Referral" r
       LEFT JOIN "ReferralQualification" q ON q."referralId" = r."id"
       WHERE r."referrerCustomerId" = $1`,
      referrerCustomerId,
    );
    return rows[0] || { invited: 0, registered: 0, firstPurchase: 0, qualifiedTopup: 0, awaitingQualification: 0, rewarded: 0 };
  }
}

function cryptoRandomId() {
  return require('node:crypto').randomUUID();
}

module.exports = { ReferralRepository };
