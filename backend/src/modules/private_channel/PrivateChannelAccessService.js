const { randomUUID } = require('crypto');

class PrivateChannelAccessService {
  constructor({ prisma, adapter, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    if (!adapter) throw new Error('adapter is required');
    this.prisma = prisma;
    this.adapter = adapter;
    this.clock = clock;
  }

  isConfigured() { return Boolean(this.adapter.isConfigured?.()); }

  async grantForPaidPeriod({ subscriptionId, customerId, validFrom, validUntil }) {
    const existing = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM "PrivateChannelAccessGrant" WHERE "subscriptionId"=$1 AND "validUntil"=$2 AND "status"=\'ACTIVE\' LIMIT 1',
      subscriptionId, validUntil,
    );
    if (existing[0]) return { ...existing[0], idempotentReplay: true };

    const id = randomUUID();
    const now = this.clock();
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO "PrivateChannelAccessGrant" ("id","subscriptionId","customerId","channelType","provider","status","validFrom","validUntil","createdAt","updatedAt") VALUES ($1,$2,$3,\'TELEGRAM\',\'TELEGRAM_BOT_API\',\'PENDING\',$4,$5,$6,$6)',
      id, subscriptionId, customerId, validFrom, validUntil, now,
    );
    try {
      const access = await this.adapter.createAccess({ customerId, validUntil });
      await this.prisma.$executeRawUnsafe(
        'UPDATE "PrivateChannelAccessGrant" SET "status"=\'ACTIVE\', "providerChatRef"=$2, "inviteLink"=$3, "grantedAt"=$4, "updatedAt"=$4 WHERE "id"=$1',
        id, access.providerChatRef, access.inviteLink, now,
      );
      return { id, subscriptionId, customerId, status: 'ACTIVE', inviteLink: access.inviteLink, validFrom, validUntil, grantedAt: now };
    } catch (error) {
      await this.prisma.$executeRawUnsafe(
        'UPDATE "PrivateChannelAccessGrant" SET "status"=\'FAILED\', "failureReason"=$2, "updatedAt"=$3 WHERE "id"=$1',
        id, String(error.code || error.message || 'UNKNOWN').slice(0, 500), now,
      );
      throw error;
    }
  }

  async revokeExpired() {
    const now = this.clock();
    const rows = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM "PrivateChannelAccessGrant" WHERE "status"=\'ACTIVE\' AND "validUntil" <= $1 ORDER BY "validUntil" ASC LIMIT 100',
      now,
    );
    const results = [];
    for (const row of rows) {
      try {
        await this.adapter.revokeAccess(row.inviteLink);
        await this.prisma.$executeRawUnsafe('UPDATE "PrivateChannelAccessGrant" SET "status"=\'REVOKED\', "revokedAt"=$2, "updatedAt"=$2 WHERE "id"=$1', row.id, now);
        results.push({ id: row.id, revoked: true });
      } catch (error) {
        results.push({ id: row.id, revoked: false, error: error.code || error.message });
      }
    }
    return results;
  }
}

module.exports = { PrivateChannelAccessService };
