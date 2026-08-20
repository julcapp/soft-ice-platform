class WelcomeBonusRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async create({ id, customerId, amountGranted, amountRemaining, status, issuedAt, expiresAt, metadata = null }) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "WelcomeBonusGrant"
       ("id","customerId","amountGranted","amountRemaining","status","issuedAt","expiresAt","metadata")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      id, customerId, amountGranted, amountRemaining, status, issuedAt, expiresAt, metadata ? JSON.stringify(metadata) : null,
    );
    return this.findById(id);
  }

  async findById(id) {
    const rows = await this.prisma.$queryRawUnsafe('SELECT * FROM "WelcomeBonusGrant" WHERE "id" = $1 LIMIT 1', id);
    return rows[0] || null;
  }

  async findActiveByCustomerId(customerId) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "WelcomeBonusGrant"
       WHERE "customerId" = $1 AND "status" IN ('ACTIVE','QUALIFIED')
       ORDER BY "issuedAt" DESC LIMIT 1`,
      customerId,
    );
    return rows[0] || null;
  }

  async qualify(id, { action, eventId, qualifiedAt }) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "WelcomeBonusGrant"
       SET "status"='QUALIFIED', "qualifiedAt"=$2, "qualifyingAction"=$3, "qualifyingEventId"=$4
       WHERE "id"=$1 AND "status"='ACTIVE'`,
      id, qualifiedAt, action, eventId,
    );
    return this.findById(id);
  }

  async expireDue(now = new Date()) {
    const rows = await this.prisma.$queryRawUnsafe(
      `UPDATE "WelcomeBonusGrant"
       SET "status"='EXPIRED', "expiredAt"=$1, "amountRemaining"=0
       WHERE "status"='ACTIVE' AND "expiresAt" <= $1
       RETURNING *`,
      now,
    );
    return rows;
  }
}

module.exports = { WelcomeBonusRepository };
